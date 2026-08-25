# Administrator access verification

The account `berkatinsani2000@gmail.com` is present in the application user table with the stable OAuth identity `XBCuLgpy7FHA2iEkRS6gd2` and the `admin` role. The normal OAuth upsert path now preserves an existing administrator role when the identity provider does not supply a role, preventing a later sign-in from silently demoting this account.

A real protected-procedure verification ran with this account identity. `clinic.adminContent` returned the persisted clinic profile and managed-media list; `clinic.updateProfile` persisted a temporary QA tagline and was then restored; `clinic.uploadMedia` uploaded a temporary 1-pixel PNG through managed storage and returned a `/manus-storage/` URL that appeared in the admin media listing; and a caller with the same identity changed to the `user` role was denied by the protected procedure.

The temporary QA media metadata was removed and the original clinic profile was restored. A direct database check confirmed the account remains `admin`, the profile tagline is `Melayani dengan kasih`, and no QA media metadata remains. The sandbox browser reached the CMS sign-in page, but an interactive OAuth login could not be completed automatically; therefore the procedure-level verification is the authoritative automated permission test, while the user should sign in manually once to confirm their browser session.

This application administrator role controls CMS access. Manus project ownership is a separate account-level setting and was not changed by this verification.
