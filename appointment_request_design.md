# Appointment-request privacy design

## Purpose

This feature records **scheduling requests**, not clinical records. The public form intentionally avoids diagnosis, symptom histories, identity numbers, medical documents, payment information, and any request for urgent care.

## Stored fields

| Field | Required | Reason |
| --- | --- | --- |
| Full name | Yes | Lets clinic staff address the requester. |
| WhatsApp / phone | Yes | Lets clinic staff confirm availability. |
| Service | Yes | Routes the request to the relevant clinic service. |
| Preferred date | Yes | Expresses a scheduling preference; it is not a confirmed booking. |
| Optional note | No | Allows a short scheduling-related note, limited to 600 characters. |
| Consent timestamp | Yes | Records agreement for staff to use the submission to reply about the request. |
| Status | System | Tracks `new`, `contacted`, or `closed` in the protected CMS. |

## Access and guardrails

Public visitors may only create a request. Only authenticated project administrators may list requests or change their status. The form includes a required consent control, an anti-spam honeypot field, Indonesian non-emergency language, and a requirement to contact emergency services directly for urgent needs. No automatic deletion job is included; the clinic should define its own retention period before collecting production requests.
