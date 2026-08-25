# WhatsApp appointment follow-up design

## Scope

The staff follow-up tool creates a **draft WhatsApp message** from a persisted appointment request. It does not send messages automatically and does not use the requester’s free-text scheduling note in the message.

## Included details

The editable draft includes only the requester’s name, selected service, preferred date, and a request to confirm availability. It omits the internal request identifier, optional note, consent timestamp, administrative status, and any medical information.

## Staff workflow

An authorized administrator opens the WhatsApp dialog from the request queue, reviews or adjusts the draft, and chooses **Open WhatsApp**. This opens WhatsApp with prefilled text for the staff member to review again and send manually. A separate status control remains responsible for marking the request as contacted or closed.
