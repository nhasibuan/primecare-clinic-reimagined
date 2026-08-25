# Logo replacement tasks

- [x] Copy the user-provided Klinik Berkat Insani logo into the managed static-asset workspace and upload it for web delivery.
- [x] Replace the existing PrimeCare logo URL in shared page references and update the page metadata.
- [x] Check desktop and mobile logo placement, then save and publish the revision.

## Visual editor verification

- [x] Merge the duplicate header style attributes into one valid JSX declaration while retaining the intended 200px square logo size.
- [x] Confirm the 100px footer logo size and verify the desktop layout, then save a refreshed checkpoint.

## Klinik Berkat Insani content update

- [x] Review the public Instagram profile and capture services, location, contacts, and stated positioning relevant to the website.
- [x] Cross-check material facts against independent public sources and identify claims that should not be presented as confirmed.
- [x] Replace the concept content with original paraphrases grounded in the verified source record.
- [x] Validate the revised site and publish an updated checkpoint.

## Supplied clinic-content review

- [x] Separate confirmed clinician, clinic, schedule, and service details from marketing proposals, unsupported market claims, and testimonial suggestions.
- [x] Cross-check the supplied schedules, contact number, address, and clinician information against publicly available sources.
- [x] Add only verified clinic details to the website in paraphrased Indonesian copy, without fabricating testimonials or outcomes.
- [x] Validate the revised layout and publish the reviewed update.

## Service-card image normalization

- [x] Inspect the current care-card image wrapper and identify why visual heights appear inconsistent.
- [x] Apply one explicit responsive height and `object-cover` crop treatment to all service-card images.
- [x] Verify desktop and mobile card image consistency, then publish the correction.

## Alur Kunjungan divider alignment

- [x] Locate the existing Alur Kunjungan rule and confirm its relationship to the section paragraph.
- [x] Move the rule beneath the paragraph and center it within the section.
- [x] Validate the desktop and mobile placement, then publish the alignment correction.

## Full-stack persistence and file storage

- [x] Define a minimum persistent data model for clinic content, service details, location information, and managed media assets.
- [x] Upgrade the project to the full-stack database and file-storage capability.
- [x] Build an authenticated administrative foundation for managing persisted clinic content and stored assets.
- [x] Verify database persistence, file storage, and public-site compatibility before publishing.
- [x] Upload a verification image through the managed storage helper, persist its metadata, and confirm its stored URL resolves.
- [x] Confirm the stored asset is visible in the CMS after refresh and include the evidence in final validation.

## Persistent appointment requests

- [x] Define a data-minimized appointment-request model with consent, retention, and non-emergency guardrails.
- [x] Create the appointment-request database table and protected backend procedures for staff review.
- [x] Add a public appointment-request form and an administrator-only request queue in the clinic CMS.
- [x] Validate public submission, database persistence, staff-only access, and responsive form usability before publishing.

## WhatsApp appointment follow-up

- [x] Define a data-minimized staff message that includes only name, service, and preferred date while excluding free-text notes.
- [x] Add an administrator-only WhatsApp follow-up action to appointment requests with manual message review before sending.
- [x] Validate generated WhatsApp links, status updates, and CMS responsiveness before publishing.

## WhatsApp staff signature template

- [x] Define a reusable clinic signature template with an approved default and clear privacy boundaries.
- [x] Persist the signature template and make it editable only by authenticated administrators.
- [x] Append the saved signature to editable WhatsApp follow-up drafts without including request notes.
- [x] Validate template persistence, draft composition, and responsive CMS controls before publishing.

## WhatsApp draft length and preview

- [x] Define a clear recommended character length and user-facing guidance for staff follow-up drafts.
- [x] Add a live character counter, length status, and formatted preview to the protected WhatsApp dialog.
- [x] Validate counter accuracy and preview usability across desktop and mobile before publishing.

## WhatsApp follow-up activity history

- [x] Define activity records that store only appointment reference, final draft length, workflow status, staff actor, and timestamp.
- [x] Create the activity-history table and administrator-only record/list procedures without storing draft text or patient notes.
- [x] Record the final draft metrics from the WhatsApp dialog and display operational history in the protected CMS.
- [x] Validate activity persistence, staff-only access, and responsive history presentation before publishing.
- [x] Create and clean up a temporary QA request while verifying recorded activity rows persist without message content or notes.
- [x] Capture the populated activity history on desktop and mobile, verifying status labels, final character counts, and timestamps.
- [x] Re-run protected-access and final production validation after end-to-end activity verification.
- [x] Capture authenticated desktop and mobile views of populated activity cards, then verify the final labels, counts, and timestamps before publishing.
- [x] Restart the CMS preview and capture settled authenticated populated-history views without relying on stale missing-session log entries.

## WhatsApp activity-history filters

- [x] Define administrator-only date-range and activity-status filter inputs, including an unfiltered default and clear empty state.
- [x] Extend the protected activity-history query to apply validated date and status filters.
- [x] Add responsive filter controls, filtered summary metrics, and reset behavior to the CMS activity history.
- [x] Validate filter accuracy, protected access, empty results, and desktop/mobile layout before publishing.
- [x] Capture authenticated desktop and mobile activity-history filters with populated results and verify the status/date controls render for staff.
- [x] Apply a no-match filter in the authenticated CMS and verify the filtered empty-state message before final release.
- [x] Inspect the authenticated desktop and mobile populated-filter captures to confirm the staff-facing controls and filtered cards are visibly rendered.
- [x] Inspect the authenticated no-match capture and confirm its protected filtered query returned zero activity rows.

## Appointment emergency-guidance wording

- [x] Verify the revised non-emergency guidance exactly matches the requested wording change.
- [x] Validate the revised public appointment form on desktop and mobile, then run production checks.
- [x] Capture and review the mobile appointment-request dialog with the revised emergency guidance before publishing.
- [x] Inspect the captured mobile dialog and record confirmation that the revised emergency guidance is visible and legible.
- [x] Save and publish the verified wording update.

## Administrator access verification

- [x] Verify berkatinsani2000@gmail.com authenticates as an administrator on the protected Klinik CMS.
- [x] Test editing a temporary clinic profile value and confirm the protected admin procedure persists it.
- [x] Test managed-file upload and listing with a temporary QA asset, then remove the asset and restore the profile.
- [x] Confirm non-admin access remains denied and all temporary QA data is cleaned up before reporting results.
- [x] Record the final administrator verification result for the user.

## Latest CMS dashboard and login check

- [x] Confirm the production `/admin` route loads its protected dashboard entry state correctly.
- [x] Verify the sign-in flow and current administrator authorization state for berkatinsani2000@gmail.com.
- [x] Report the dashboard and login verification result.
- [x] Complete a real authenticated browser login for berkatinsani2000@gmail.com and confirm the CMS dashboard renders.
- [x] Run a protected CMS query or action within that authenticated browser session and record the result.
- [x] Deliver the final dashboard and login verification summary after the authenticated browser check.

## Public appointment rate limiting

- [x] Define the IP-keyed submission window, threshold, trusted-proxy behavior, and retry response without collecting additional patient data.
- [x] Implement server-side appointment rate-limit logic while preserving the existing honeypot behavior.
- [x] Add unit tests that allow normal submissions and reject rapid repeated requests from the same IP.
- [x] Validate tests, types, production build, and protected endpoint behavior before publishing.
- [x] Prune expired client entries from the in-memory rate-limit store to bound memory use under high-cardinality traffic.
- [x] Add router-level appointment-create tests covering normal requests, rapid same-IP rejection, and honeypot short-circuit behavior.
- [x] Re-run full validation after bounded-memory and endpoint-level rate-limit coverage is complete.
