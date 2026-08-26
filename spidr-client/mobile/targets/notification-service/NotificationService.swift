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
//        Icon = the SERVER's or GROUP's icon, title = who posted, subtitle =
//        where, body = the message.
//
//  Both shapes read the icon from the same "image" data key, because the
//  server already resolved which picture belongs there (a server's own icon,
//  or the sender's pfp when it has none).
//
//  DESIGN NOTE — why the layout does not rely on iOS's group rendering:
//  the obvious way to build the group shape is speakableGroupName plus
//  setImage(_:forParameterNamed: \.speakableGroupName). That is not reliable.
//  With recipients nil, iOS silently renders the intent as a 1:1: it takes the
//  icon from INPerson.image, takes the title from INPerson.displayName, and
//  DISCARDS the subtitle — which is exactly how server mentions ended up
//  looking like DMs. So instead:
//
//    • the icon we want always goes on INPerson.image, which iOS honours in
//      both shapes (it is what makes the DM banner work today), and
//    • the subtitle is re-applied AFTER updating(from:), so the middle line
//      survives whatever iOS decides to do with it.
//
//  recipients is still populated for group pushes so the conversation is
//  described honestly, but no visible slot depends on iOS accepting it.
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

        let sender = INPerson(
            personHandle: INPersonHandle(value: senderId.isEmpty ? senderName : senderId, type: .unknown),
            nameComponents: nil,
            displayName: senderName,
            // The icon slot. For a group push this is deliberately the SERVER's
            // picture rather than the poster's — iOS paints INPerson.image and
            // does not reliably paint the group image.
            image: image,
            contactIdentifier: nil,
            customIdentifier: senderId.isEmpty ? nil : senderId
        )

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
            recipients: groupName == nil ? nil : [me],
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: groupName.map { INSpeakableString(spokenPhrase: $0) },
            conversationIdentifier: content.threadIdentifier.isEmpty ? nil : content.threadIdentifier,
            serviceName: "Spidr",
            sender: sender,
            attachments: nil
        )
        if let image = image, groupName != nil {
            intent.setImage(image, forParameterNamed: \.speakableGroupName)
        }

        // Donating marks the intent as INCOMING, which is what tells iOS to
        // render the sender's side rather than the current user's.
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)

        guard let updated = try? content.updating(from: intent) else { return nil }

        // updating(from:) drops the subtitle whenever iOS decides to render the
        // intent as a 1:1. Put it back so the middle line never depends on that
        // decision.
        guard let groupName = groupName, updated.subtitle != groupName else { return updated }
        guard let restored = updated.mutableCopy() as? UNMutableNotificationContent else { return updated }
        restored.subtitle = groupName
        return restored
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
