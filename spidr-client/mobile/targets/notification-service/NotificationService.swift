//
//  NotificationService.swift — Notification Service Extension
//
//  Runs in its own tiny process whenever a push arrives with
//  "mutable-content": 1 in the aps payload. Its job: make the banner look
//  like it came from a PERSON rather than from Spidr.
//
//  iOS has two very different ways to put an image on a notification and
//  only one of them does what we want:
//
//    • UNNotificationAttachment — renders as a small thumbnail on the
//      TRAILING edge of the banner (and full-size when expanded). The
//      leading icon stays the app icon, always.
//
//    • Communication Notification (INSendMessageIntent, iOS 15+) — hands
//      iOS an intent describing who sent the message. iOS then REPLACES the
//      leading icon with the sender's avatar, shows their name as the title,
//      and files the push under Messages-style notification settings.
//
//  Two shapes come through here, mirroring the two shapes iMessage itself
//  uses. Which one you get is decided entirely by the server — this
//  extension just reads the payload:
//
//    1:1 (DMs, friend requests) — one-line sender. Icon = sender's avatar
//        ("image"), title = sender's name.
//
//    Group (server mentions) — the three-line iMessage-group layout. Icon =
//        the SERVER's icon ("image"), title = the person who mentioned you
//        ("senderName", with their own pfp in "senderAvatar"), subtitle =
//        the server/channel, body = the message. A non-empty subtitle is
//        what flags a push as group-shaped; the server sets it via
//        aps.alert.subtitle (see spidr-server utils/push.js).
//
//  If the intent path fails at any point we fall back to the old trailing
//  attachment, and if that fails too we deliver the original notification
//  untouched — a push NEVER gets lost because an image could not be fetched.
//
//  Deliberately has ZERO Firebase dependency. FCM's own image-forwarding
//  (apns.fcm_options.image / FIRMessagingExtensionHelper) has an
//  undocumented wire format and would require linking FirebaseMessaging
//  into this second target too — real risk given the main app's Podfile
//  already needs $RNFirebaseDisableSPM + use_modular_headers! to avoid
//  duplicate-symbol errors (see plugins/withRnFirebaseDisableSpm.js). Plain
//  URLSession downloads reading our own data keys sidestep all of that:
//  this target links nothing but Apple's own frameworks.
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

        // Group a conversation's (or a channel's) banners together so iOS
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
        // Make sure the middle line actually renders even if aps.alert lost it.
        if let groupName = groupName, bestAttemptContent.subtitle.isEmpty {
            bestAttemptContent.subtitle = groupName
        }

        // `image` is the icon iOS should show: the sender's pfp for a 1:1,
        // the server's icon for a mention. `senderAvatar` only rides along on
        // group-shaped pushes, carrying the person inside the group.
        let iconURL = (info["image"] as? String).flatMap(URL.init(string:))
        let senderAvatarURL = (info["senderAvatar"] as? String).flatMap(URL.init(string:))

        fetch(iconURL, senderAvatarURL) { [weak self] icon, senderAvatar in
            guard let self = self else { return }
            // On a 1:1 the icon IS the sender's avatar; on a group it's the
            // server, and the person's pfp comes from the second download.
            let personImage = groupName == nil ? icon : senderAvatar
            self.deliver(
                senderName: senderName,
                senderId: senderId,
                personImage: personImage,
                groupName: groupName,
                groupImage: groupName == nil ? nil : icon
            )
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
        personImage: DownloadedImage?,
        groupName: String?,
        groupImage: DownloadedImage?
    ) {
        guard let bestAttemptContent = bestAttemptContent else { return }

        if let updated = communicationContent(
            from: bestAttemptContent,
            senderName: senderName,
            senderId: senderId,
            personImageData: personImage?.data,
            groupName: groupName,
            groupImageData: groupImage?.data
        ) {
            contentHandler?(updated)
            return
        }

        // Intent path unavailable (capability missing, iOS refused the
        // update) — fall back to the trailing-thumbnail attachment so the
        // image is at least visible somewhere on the banner.
        let fallback = groupImage ?? personImage
        if let fallback = fallback, let attachment = attachment(from: fallback) {
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
        personImageData: Data?,
        groupName: String?,
        groupImageData: Data?
    ) -> UNNotificationContent? {
        // A communication notification with no identifiable sender is worse
        // than a plain one — iOS shows a blank silhouette.
        guard !senderName.isEmpty else { return nil }

        let handle = INPersonHandle(
            value: senderId.isEmpty ? senderName : senderId,
            type: .unknown
        )
        let sender = INPerson(
            personHandle: handle,
            nameComponents: nil,
            displayName: senderName,
            image: personImageData.map { INImage(imageData: $0) },
            contactIdentifier: nil,
            customIdentifier: senderId.isEmpty ? nil : senderId
        )

        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: groupName.map { INSpeakableString(spokenPhrase: $0) },
            conversationIdentifier: content.threadIdentifier.isEmpty ? nil : content.threadIdentifier,
            serviceName: "Spidr",
            sender: sender,
            attachments: nil
        )

        // Which parameter the image hangs off decides which slot iOS paints
        // it into: \.sender for a 1:1 avatar, \.speakableGroupName for the
        // group icon (the server, in our case).
        if let groupImageData = groupImageData {
            intent.setImage(INImage(imageData: groupImageData), forParameterNamed: \.speakableGroupName)
        } else if let personImageData = personImageData {
            intent.setImage(INImage(imageData: personImageData), forParameterNamed: \.sender)
        }

        // Donating marks the intent as INCOMING, which is what tells iOS to
        // render the sender's avatar rather than the current user's.
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)

        return try? content.updating(from: intent)
    }

    // MARK: - Image fetching

    struct DownloadedImage {
        let data: Data
        let ext: String
    }

    /// Fetches both URLs in parallel and calls back once, on whatever thread
    /// finishes last. Either or both may come back nil — that is not an error.
    ///
    /// The two URLs are identical whenever a group has no icon of its own and
    /// the server falls back to the sender's pfp for both slots, so that case
    /// is collapsed to a single request.
    private func fetch(
        _ first: URL?,
        _ second: URL?,
        completion: @escaping (DownloadedImage?, DownloadedImage?) -> Void
    ) {
        if let first = first, first == second {
            download(from: first) { completion($0, $0) }
            return
        }

        var firstResult: DownloadedImage?
        var secondResult: DownloadedImage?
        let group = DispatchGroup()

        if let first = first {
            group.enter()
            download(from: first) { firstResult = $0; group.leave() }
        }
        if let second = second {
            group.enter()
            download(from: second) { secondResult = $0; group.leave() }
        }

        group.notify(queue: .global()) { completion(firstResult, secondResult) }
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
