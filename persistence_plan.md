# Persistent clinic-content foundation

## Purpose

The public website will retain its existing design while reading editable clinic information from persistent records. A protected administration area will provide the starting point for later editing by authorized clinic staff.

## Initial data model

| Entity | Persistent fields | Purpose |
| --- | --- | --- |
| `clinic_profile` | `name`, `tagline`, `address`, `whatsapp_url`, `instagram_url`, `updated_at` | Stores the clinic identity, public location, and contact channels. |
| `service` | `name`, `summary`, `description`, `image_url`, `sort_order`, `is_published` | Stores the public service cards and detailed copy. |
| `clinician` | `name`, `credentials`, `specialty`, `bio`, `photo_url`, `is_published` | Stores approved clinician details; only verified and authorized records should be published. |
| `opening_schedule` | `service_id`, `day_label`, `start_time`, `end_time`, `notes`, `is_published` | Stores confirmed schedules separately from copy so they can be updated without code changes. |
| `media_asset` | `storage_key`, `public_url`, `alt_text`, `mime_type`, `category`, `uploaded_at` | Tracks managed file-storage uploads and their approved public usage. |

## File-storage conventions

Administrative uploads will be stored in managed file storage and referenced through persistent `media_asset` records. Images must include alt text and a category such as `service`, `clinician`, `facility`, or `brand`. Public content will reference an approved stored URL rather than an arbitrary external link.

## Safety and publishing guardrails

Only authenticated administrators may create or alter persisted content. Clinician details, schedules, service claims, and public contact information remain unpublished until an authorized user has reviewed them. The foundation deliberately excludes patient records, appointments, clinical notes, and other sensitive health data.
