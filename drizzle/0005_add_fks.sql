-- Migration: Add foreign‑key constraints
-- Generated 2024‑09‑13

ALTER TABLE opening_schedules
  ADD CONSTRAINT opening_schedules_clinicianId_fk
    FOREIGN KEY (clinicianId) REFERENCES clinicians(id)
    ON DELETE SET NULL;

ALTER TABLE opening_schedules
  ADD CONSTRAINT opening_schedules_serviceId_fk
    FOREIGN KEY (serviceId) REFERENCES services(id)
    ON DELETE SET NULL;

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_uploadedBy_fk
    FOREIGN KEY (uploadedBy) REFERENCES users(id)
    ON DELETE RESTRICT;

ALTER TABLE whatsapp_follow_up_activities
  ADD CONSTRAINT whatsapp_follow_up_activities_appointmentRequestId_fk
    FOREIGN KEY (appointmentRequestId) REFERENCES appointment_requests(id)
    ON DELETE CASCADE;

ALTER TABLE whatsapp_follow_up_activities
  ADD CONSTRAINT whatsapp_follow_up_activities_recordedBy_fk
    FOREIGN KEY (recordedBy) REFERENCES users(id)
    ON DELETE RESTRICT;

ALTER TABLE whatsapp_signature_templates
  ADD CONSTRAINT whatsapp_signature_templates_updatedBy_fk
    FOREIGN KEY (updatedBy) REFERENCES users(id)
    ON DELETE RESTRICT;
