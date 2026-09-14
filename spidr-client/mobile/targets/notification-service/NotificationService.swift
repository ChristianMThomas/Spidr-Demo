//
//  NotificationService.swift — Notification Service Extension
//
//  Runs in its own tiny process whenever a push arrives with
//  "mutable-content": 1 in the aps payload. Its job: make the banner look
//  like it came from a PERSON (or a server/group) rather than from Spidr.
//
//  iOS has two ways to put an image on a notification and only one does what
//  we want. A UNNotificationAttachment renders as a small thumbnail on the
//  TRAILING edge and never touches the leading icon. A Communication
//  Notification (INSendMessageIntent, iOS 15+) hands iOS an intent describing
//  who sent the message, and iOS REPLACES the leading icon and the title from
//  it. So everything visible here is driven by the intent.
//
//  Two shapes come through, decided entirely by the server — this extension
//  just reads the payload:
//
//    1:1 (DMs, friend requests) — no subtitle. Icon = the sender's avatar.
//
//    Group (server mentions, server messages, group chats) — subtitle present.
//        Icon = the SERVER's or GROUP's icon, title = WHERE it was posted,
//        body = "who: the message". The place goes in the title because that
//        is the only slot besides the body that iOS paints here — see the
//        design note below.
//
//  Both shapes read the icon from the same "image" data key, because the
//  server already resolved which picture belongs there (a server's own icon,
//  or the sender's pfp when it has none).
//
//  DESIGN NOTE — a communication notification has TWO paintable slots, not
//  three. iOS takes the title from INPerson.displayName and prints the body.
//  It does not paint content.subtitle at all, and nothing brings it back:
//  setting it before updating(from:), or re-applying it after, changes only
//  what the content object says, never what the banner shows. An earlier
//  version did exactly that, on the theory that iOS was mis-rendering the
//  intent as a 1:1 and dropping the middle line as a side effect. It was not.
//  A push the server confirmed as group-shaped (PUSH_DEBUG=1 stamped it
//  [GROUP/img]) still arrived on device with no middle line.
//
//  So the group shape is composed for two slots, the way Messages composes a
//  group banner:
//
//    • INPerson.displayName carries the GROUP name, so the title says where,
//    • the poster is folded into the body as "Name: message", so who is
//      still visible without a slot of its own, and
//    • the icon goes on INPerson.image, which iOS honours in both shapes
//      (it is what makes the DM banner work today).
//
//  INPerson also identifies the CONVERSATION rather than the poster for group
//  pushes — every message in a channel must map to one person or iOS threads
//  each poster separately. recipients is still populated so the conversation
//  is described honestly, but no visible slot depends on iOS accepting it.
//
//  The subtitle is still SENT by the server and still read here: it is how
//  this file tells group from 1:1, and the attachment fallback below is a
//  plain notification, where iOS does render a real subtitle line.
//
//  Fails safe at every step: if the intent is refused we fall back to the
//  trailing attachment, and if that fails too the original notification is
//  delivered untouched. A push is NEVER lost because an image couldn't load.
//
//  Deliberately has ZERO Firebase dependency. FCM's own image-forwarding
//  (apns.fcm_options.image / FIRMessagingExtensionHelper) has an undocumented
//  wire format and would require linking FirebaseMessaging into this second
//  target too — real risk given the main app's Podfile already needs
//  $RNFirebaseDisableSPM + use_modular_headers! to avoid duplicate-symbol
//  errors (see plugins/withRnFirebaseDisableSpm.js). A plain URLSession
//  download reading our own data key sidesteps all of that: this target links
//  nothing but Apple's own frameworks.
//
//  Requires the "Communication Notifications" capability
//  (com.apple.developer.usernotifications.communication) on BOTH this target
//  and the main app — see expo-target.config.js and app.json.
//

import UserNotifications
import Intents

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        let info = bestAttemptContent.userInfo

        // Group a channel's (or a conversation's) banners together so iOS
        // stacks them the way Messages does instead of listing each one.
        let threadKey = (info["channelId"] as? String) ?? (info["conversationId"] as? String)
        if let threadKey = threadKey, !threadKey.isEmpty {
            bestAttemptContent.threadIdentifier = threadKey
        }

        // Sender name: the server puts it in the title for both shapes, but
        // prefer the explicit data key — it survives any future title rewording.
        let senderName = nonEmpty(info["senderName"] as? String) ?? bestAttemptContent.title
        let senderId = (info["senderId"] as? String) ?? ""

        // A subtitle means "this push has a context line" → group-shaped.
        // Read the data key first: FCM merges its top-level `notification`
        // block into aps.alert, so aps.alert.subtitle is not something to
        // stake the whole layout on. userInfo arrives untouched.
        let groupName = nonEmpty(info["subtitle"] as? String)
            ?? nonEmpty(bestAttemptContent.subtitle)
        // Make sure the middle line is set going in, too.
        if let groupName = groupName, bestAttemptContent.subtitle.isEmpty {
            bestAttemptContent.subtitle = groupName
        }

        // One image, one download: the server already decided which picture
        // belongs in the icon slot for this push.
        guard
            let imageURLString = info["image"] as? String,
            let imageURL = URL(string: imageURLString)
        else {
            deliver(senderName: senderName, senderId: senderId, icon: nil, groupName: groupName)
            return
        }

        download(from: imageURL) { [weak self] icon in
            guard let self = self else { return }
            self.deliver(senderName: senderName, senderId: senderId, icon: icon, groupName: groupName)
        }
    }

    // Called by iOS if we are about to run out of the ~30s extension time
    // budget (e.g. a slow/stalled image host) — must still deliver SOMETHING.
    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Delivery

    private func deliver(
        senderName: String,
        senderId: String,
        icon: DownloadedImage?,
        groupName: String?
    ) {
        guard let bestAttemptContent = bestAttemptContent else { return }

        // Set by the server only while PUSH_DEBUG=1. Makes the banner itself
        // report which branch ran, so a broken layout doesn't have to be
        // diagnosed by guesswork.
        let debug = (bestAttemptContent.userInfo["pushDebug"] as? String) == "1"
        if debug {
            bestAttemptContent.body += " [\(groupName == nil ? "1:1" : "GROUP")/\(icon == nil ? "no-img" : "img")]"
        }

        if let updated = communicationContent(
            from: bestAttemptContent,
            senderName: senderName,
            senderId: senderId,
            iconData: icon?.data,
            groupName: groupName
        ) {
            contentHandler?(updated)
            return
        }

        if debug {
            // Reaching here means updating(from:) refused the intent — the
            // banner falls back to a plain attachment, which looks like a 1:1.
            bestAttemptContent.body += " [INTENT-REJECTED]"
        }

        // Intent path unavailable (capability missing, iOS refused the
        // update) — fall back to the trailing-thumbnail attachment so the
        // image is at least visible somewhere on the banner. The subtitle is
        // already set on the content, so the three lines still render.
        if let icon = icon, let attachment = attachment(from: icon) {
            bestAttemptContent.attachments = [attachment]
        }
        contentHandler?(bestAttemptContent)
    }

    /// Builds an INSendMessageIntent and asks iOS to restyle the notification
    /// around it. Returns nil if any step fails, so the caller can fall back.
    private func communicationContent(
        from content: UNMutableNotificationContent,
        senderName: String,
        senderId: String,
        iconData: Data?,
        groupName: String?
    ) -> UNNotificationContent? {
        // A communication notification with no identifiable sender is worse
        // than a plain one — iOS shows a blank silhouette.
        guard !senderName.isEmpty else { return nil }

        let image = iconData.map { INImage(imageData: $0) }

        // A communication notification has exactly TWO paintable slots: the
        // title, which iOS takes from INPerson.displayName, and the body.
        // There is no third slot — iOS discards content.subtitle when it
        // restyles around the intent, no matter what we set it to afterwards.
        // Verified on device: a push confirmed [GROUP/img] by the server still
        // rendered without its middle line.
        //
        // So a group push is composed the way Messages composes one: the place
        // goes in the title, the poster is folded into the body. The poster
        // stays visible and the banner stops reading as a 1:1 from that person.
        //
        //   1:1    title "ChrisAlt"                      body "the message"
        //   group  title "Anime Haven · #general-chat"   body "ChrisAlt: the message"
        let isGroup = groupName != nil
        let displayName = groupName ?? senderName

        // Identity of the CONVERSATION, not the poster. For a group every
        // message must map to the same person or iOS treats each poster as a
        // separate thread and stacking breaks; the channel/conversation id is
        // that stable identity. 1:1 keeps the sender's own id.
        let handleValue: String = {
            if !isGroup { return senderId.isEmpty ? senderName : senderId }
            return content.threadIdentifier.isEmpty ? displayName : content.threadIdentifier
        }()

        let sender = INPerson(
            personHandle: INPersonHandle(value: handleValue, type: .unknown),
            nameComponents: nil,
            displayName: displayName,
            // The icon slot. For a group push this is deliberately the SERVER's
            // picture rather than the poster's — iOS paints INPerson.image and
            // does not reliably paint the group image.
            image: image,
            contactIdentifier: nil,
            customIdentifier: handleValue.isEmpty ? nil : handleValue
        )

        // Compose on a COPY. `content` is also what the caller falls back to
        // when the intent is refused, and that path renders a real subtitle
        // line — prefixing its body there would print the poster's name twice.
        guard let composed = content.mutableCopy() as? UNMutableNotificationContent else { return nil }
        if isGroup && !senderName.isEmpty {
            composed.body = senderName + ": " + content.body
        }

        // A group conversation needs recipients for iOS to describe it as one.
        // "me" is enough — the extension has no roster, and nothing visible
        // depends on this being complete.
        let me = INPerson(
            personHandle: INPersonHandle(value: "me", type: .unknown),
            nameComponents: nil,
            displayName: nil,
            image: nil,
            contactIdentifier: nil,
            customIdentifier: nil,
            isMe: true,
            // Spelled out rather than `.none` — bare `.none` is ambiguous with
            // Optional.none at this position and won't compile cleanly.
            suggestionType: INPersonSuggestionType.none
        )

        let intent = INSendMessageIntent(
            recipients: isGroup ? [me] : nil,
            outgoingMessageType: .outgoingMessageText,
            content: composed.body,
            speakableGroupName: groupName.map { INSpeakableString(spokenPhrase: $0) },
            conversationIdentifier: content.threadIdentifier.isEmpty ? nil : content.threadIdentifier,
            serviceName: "Spidr",
            sender: sender,
            attachments: nil
        )
        if let image = image, isGroup {
            intent.setImage(image, forParameterNamed: \.speakableGroupName)
        }

        // Donating marks the intent as INCOMING, which is what tells iOS to
        // render the sender's side rather than the current user's.
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)

        guard let updated = try? composed.updating(from: intent) else { return nil }

        // No subtitle is re-applied here on purpose. The previous version put
        // it back after updating(from:), on the theory that iOS had dropped it
        // by mis-rendering the intent as a 1:1 — but iOS never paints a
        // subtitle on a communication notification at all, so restoring it
        // only made the content disagree with the banner. The context now
        // lives in the title, which iOS does paint.
        return updated
    }

    // MARK: - Image fetching

    struct DownloadedImage {
        let data: Data
        let ext: String
    }

    private func download(from url: URL, completion: @escaping (DownloadedImage?) -> Void) {
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            guard let data = data, !data.isEmpty, error == nil else {
                completion(nil)
                return
            }
            completion(DownloadedImage(data: data, ext: Self.fileExtension(for: response?.mimeType)))
        }
        task.resume()
    }

    /// UNNotificationAttachment reads content type off the file extension, so
    /// the temp file needs a real one.
    private func attachment(from image: DownloadedImage) -> UNNotificationAttachment? {
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + "." + image.ext)
        do {
            try image.data.write(to: destination)
            return try UNNotificationAttachment(identifier: "avatar", url: destination, options: nil)
        } catch {
            return nil
        }
    }

    private static func fileExtension(for mimeType: String?) -> String {
        switch mimeType {
        case "image/png": return "png"
        case "image/gif": return "gif"
        case "image/webp": return "webp"
        default: return "jpg"
        }
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value = value, !value.isEmpty else { return nil }
        return value
    }
}
