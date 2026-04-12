-- =============================================================================
-- Migration: 20240101000017_create_appointments.sql
-- Description: Creates the appointments table for AutoPro multi-tenant SaaS.
--              Manages workshop scheduling — a client brings a vehicle in at a
--              specific date/time for a given service. An appointment may later
--              be converted into a service order.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: appointments
-- Represents a scheduled visit by a client with their vehicle to the workshop.
-- The service_order_id column is a soft reference (no FK constraint) because
-- service_orders is created in a later migration and circular FKs between
-- appointments and service_orders are avoided at the DB level.
-- -----------------------------------------------------------------------------
CREATE TABLE public.appointments (
    -- Primary key
    id                  uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id     uuid            NOT NULL,

    -- Parties involved
    client_id           uuid            NOT NULL,
    vehicle_id          uuid            NOT NULL,

    -- Scheduling
    appointment_date    date            NOT NULL,
    time                varchar(5)      NOT NULL,   -- stored as HH:MM (24-hour)

    -- Service details
    service_type        varchar(200)    NOT NULL,

    -- 'low' | 'medium' | 'high' — used for queue prioritization
    priority            varchar(10)
                            CHECK (priority IN ('low', 'medium', 'high')),

    -- Lifecycle status
    -- scheduled  → newly created, awaiting confirmation
    -- confirmed  → workshop confirmed the slot
    -- cancelled  → appointment was cancelled
    -- completed  → appointment took place; may have a linked service order
    status              varchar(20)     NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),

    -- Soft reference to the resulting service order (no DB-level FK to avoid
    -- circular dependency with service_orders; integrity enforced in app layer)
    service_order_id    uuid,

    -- Additional info
    notes               text,

    -- Audit columns
    created_at          timestamptz     NOT NULL DEFAULT now(),
    created_by          varchar(200),
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    updated_by          varchar(200),
    deleted_at          timestamptz,
    deleted_by          varchar(200),

    -- Constraints
    CONSTRAINT appointments_pkey
        PRIMARY KEY (id),

    CONSTRAINT appointments_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT appointments_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES public.clients (id)
        ON DELETE CASCADE,

    CONSTRAINT appointments_vehicle_id_fkey
        FOREIGN KEY (vehicle_id)
        REFERENCES public.vehicles (id)
        ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.appointments IS 'Workshop appointment schedule. Each record represents a planned client + vehicle visit for a specific service.';
COMMENT ON COLUMN public.appointments.time             IS 'Scheduled time of day in HH:MM (24-hour) format.';
COMMENT ON COLUMN public.appointments.service_order_id IS 'Soft reference to the service order created from this appointment. No FK constraint — integrity is enforced at the application layer to avoid circular dependencies.';
COMMENT ON COLUMN public.appointments.priority         IS 'Urgency level: low, medium, or high. Used for technician queue prioritization.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant filter — base scan for all appointment queries
CREATE INDEX idx_appointments_organization_id
    ON public.appointments (organization_id)
    WHERE deleted_at IS NULL;

-- FK indexes for joins to clients and vehicles
CREATE INDEX idx_appointments_client_id
    ON public.appointments (client_id);

CREATE INDEX idx_appointments_vehicle_id
    ON public.appointments (vehicle_id);

-- Daily schedule view: appointments for a given org on a specific date
CREATE INDEX idx_appointments_organization_id_appointment_date
    ON public.appointments (organization_id, appointment_date)
    WHERE deleted_at IS NULL;

-- Status-based filtering: e.g. "show all pending confirmations for this org"
CREATE INDEX idx_appointments_organization_id_status
    ON public.appointments (organization_id, status)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every row modification
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- SELECT: only rows belonging to the authenticated user's organization
CREATE POLICY "appointments_select_same_org"
    ON public.appointments
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- INSERT: enforce org scoping at write time
CREATE POLICY "appointments_insert_same_org"
    ON public.appointments
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

-- UPDATE: enforce org scoping on both the existing row and the new values
CREATE POLICY "appointments_update_same_org"
    ON public.appointments
    FOR UPDATE
    TO authenticated
    USING  (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

-- DELETE: soft deletes are preferred, but hard-delete is also org-scoped
CREATE POLICY "appointments_delete_same_org"
    ON public.appointments
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
