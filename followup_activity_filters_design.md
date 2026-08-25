# WhatsApp follow-up activity filters

The protected activity history supports an optional local-calendar start date, end date, and action-status filter. The action-status values are **draft_copied** and **whatsapp_opened**; they remain distinct from the appointment workflow status. With no filter selected, administrators see the full activity history.

The browser translates each selected calendar date to the start or end of that local day before sending it to the protected query. The server validates that the start is not after the end, applies the supplied conditions to the activity timestamp, and returns only activity metadata already permitted to administrators. Filtering never introduces draft content, patient notes, or clinical data into the history response.

Authenticated visual review confirmed that the mobile status-filtered history presented the selected **WhatsApp dibuka** option, one matching activity card, its 145-character final length, and the responsive date controls. A desktop no-match capture showed the selected 2031 start date, zero filtered activities, and the staff-facing message “Tidak ada aktivitas yang sesuai dengan filter saat ini.”

The desktop populated-filter capture was also reviewed directly: the selected **WhatsApp dibuka** status, both date fields, reset action, “1 aktivitas terfilter” summary, and the single matching 145-character activity card were all visible and legible.

The authenticated CMS network record for the no-match view requested `messageStatus=whatsapp_opened` with a `2031-01-01` start date and returned an empty `appointments.listFollowUpActivities` result, matching the rendered empty-state message.
