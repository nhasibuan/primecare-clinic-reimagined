# WhatsApp follow-up activity history

Each activity record stores only the appointment reference, the final draft’s character count, the staff action, the staff user ID, and the UTC timestamp. The supported action values are **draft_copied** and **whatsapp_opened**. These fields allow staff to track follow-up progress and message-length patterns without storing the message body, patient note, diagnosis, or any additional clinical information.

The activity history is visible only through the protected clinic CMS. Opening WhatsApp records the final length immediately before the external app is launched; copying the draft records the equivalent final length at the copy action. The existing appointment workflow status remains separate and continues to be controlled by staff.

End-to-end QA verified that both supported actions persisted the final 311-character draft length, rendered their Indonesian status labels and timestamps in the protected desktop and mobile CMS, and were fully removed afterward. The temporary QA appointment and both activity rows were confirmed absent after cleanup.

The final authenticated mobile capture visibly showed the populated **Draf disalin** and **WhatsApp dibuka** cards, their 317-character final lengths, and Indonesian timestamps. The full-page desktop capture independently showed the same two populated activity cards, readable 317-character counts, Indonesian timestamps, and a 317-character average.
