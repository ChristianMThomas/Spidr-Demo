//
//  NotificationService.swift — Notification Service Extension
//
//  Runs in its own tiny process whenever a push arrives with
//  "mutable-content": 1 in the aps payload. Its only job: turn the sender's
//  avatar URL (sent as a plain custom data field — see spidr-server's
//  utils/push.js, key "image") into a real UNNotificationAttachment before
//  the OS renders the banner, so the notification gets the big circular
//  avatar (iOS composites the small app-icon corner badge automatically —
//  nothing to do for that part).
//
//  Deliberately has ZERO Firebase dependency. FCM's own image-forwarding
//  (apns.fcm_options.image / FIRMessagingExtensionHelper) has an
//  undocumented wire format and would require linking FirebaseMessaging
//  into this second target too — real risk given the main app's Podfile
//  already needs $RNFirebaseDisableSPM + use_modular_headers! to avoid
//  duplicate-symbol errors (see plugins/withRnFirebaseDisableSpm.js). A
//  plain URLSession download reading our own "image" key sidesteps all of
//  that: this target links nothing but Apple's own UserNotifications.
//
//  Fails safe: any error (bad URL, timeout, 404) just delivers the original
//  notification unmodified — a push NEVER gets lost because the image
//  couldn't be fetched.
//

import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard
            let bestAttemptContent = bestAttemptContent,
            let imageURLString = bestAttemptContent.userInfo["image"] as? String,
            let imageURL = URL(string: imageURLString)
        else {
            // No image field (or malformed) — deliver the banner as-is.
            contentHandler(request.content)
            return
        }

        downloadImage(from: imageURL) { [weak self] attachment in
            guard let self = self, let bestAttemptContent = self.bestAttemptContent else { return }
            if let attachment = attachment {
                bestAttemptContent.attachments = [attachment]
            }
            self.contentHandler?(bestAttemptContent)
        }
    }

    // Called by iOS if we're about to run out of the ~30s extension time
    // budget (e.g. a slow/stalled image host) — must still deliver SOMETHING.
    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    private func downloadImage(from url: URL, completion: @escaping (UNNotificationAttachment?) -> Void) {
        let task = URLSession.shared.downloadTask(with: url) { location, response, error in
            guard let location = location, error == nil else {
                completion(nil)
                return
            }

            // UNNotificationAttachment infers content type from the file
            // extension, so the temp file needs a real one — derive it from
            // the response's MIME type, falling back to jpg.
            let ext = Self.fileExtension(for: response?.mimeType)
            let tmpDir = FileManager.default.temporaryDirectory
            let destination = tmpDir.appendingPathComponent(UUID().uuidString + "." + ext)

            do {
                try FileManager.default.moveItem(at: location, to: destination)
                let attachment = try UNNotificationAttachment(
                    identifier: "avatar",
                    url: destination,
                    options: nil
                )
                completion(attachment)
            } catch {
                completion(nil)
            }
        }
        task.resume()
    }

    private static func fileExtension(for mimeType: String?) -> String {
        switch mimeType {
        case "image/png": return "png"
        case "image/gif": return "gif"
        case "image/webp": return "webp"
        default: return "jpg"
        }
    }
}
