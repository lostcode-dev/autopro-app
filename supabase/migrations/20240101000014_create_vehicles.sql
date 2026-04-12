-- =============================================================================
-- Migration: 20240101000014_create_vehicles.sql
-- Description: Creates the vehicles table for managing customer vehicles per
--              organization. Each vehicle belongs to a client and stores
--              identification (plate), specs (brand, model, year, engine),
--              fuel type, current mileage, and free-form notes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: vehicles
-- -----------------------------------------------------------------------------
CREATE TABLE public.vehicles (
  -- Primary key
  id               uuid         NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scoping
  organization_id  uuid         NOT NULL,

  -- Ownership
  client_id        uuid         NOT NULL,  -- The customer who owns this vehicle

  -- Identification
  license_plate    varchar(10),            -- Brazilian plate: ABC-1234 or Mercosul ABC1D23
  brand            varchar(100),           -- Manufacturer, e.g. 'Toyota', 'Chevrolet'
  model            varchar(100),           -- Model name, e.g. 'Corolla', 'Onix'
  year             int,                    -- Model year (e.g. 2021)
  color            varchar(50),

  -- Mechanical specs
  engine           varchar(100),           -- Engine displacement / description, e.g. '1.0 Turbo'

  -- Fuel type.
  -- Allowed: gasoline, ethanol, diesel, flex, cng, electric, hybrid
  fuel_type        varchar(20),

  -- Current odometer reading in kilometers
  mileage          int,

  -- Free-form technician / service notes
  notes            text,

  -- Audit columns
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(200),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(200),
  deleted_at       timestamptz,
  deleted_by       varchar(200),

  -- Constraints
  CONSTRAINT vehicles_pkey PRIMARY KEY (id),

  CONSTRAINT vehicles_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE CASCADE,

  CONSTRAINT vehicles_client_id_fkey
    FOREIGN KEY (client_id)
    REFERENCES public.clients (id)
    ON DELETE CASCADE,

  CONSTRAINT vehicles_fuel_type_check
    CHECK (
      fuel_type IS NULL OR
      fuel_type IN ('gasoline', 'ethanol', 'diesel', 'flex', 'cng', 'electric', 'hybrid')
    )
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.vehicles               IS 'Customer-owned vehicles registered per organization.';
COMMENT ON COLUMN public.vehicles.license_plate IS 'Brazilian license plate: old format ABC-1234 or Mercosul ABC1D23. Stored without hyphen.';
COMMENT ON COLUMN public.vehicles.fuel_type     IS 'gasoline=Gasolina, ethanol=Etanol, diesel=Diesel, flex=Flex, cng=GNV, electric=Elétrico, hybrid=Híbrido.';
COMMENT ON COLUMN public.vehicles.mileage       IS 'Odometer reading in kilometers at the time of last update.';
COMMENT ON COLUMN public.vehicles.engine        IS 'Engine description, e.g. "1.0 Turbo TSI" or "2.0 16V".';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Org-scoped active-record index
CREATE INDEX idx_vehicles_organization_id
  ON public.vehicles (organization_id)
  WHERE deleted_at IS NULL;

-- Fast lookup of vehicles by client within active records
CREATE INDEX idx_vehicles_client_id
  ON public.vehicles (client_id)
  WHERE deleted_at IS NULL;

-- Fast lookup by license plate within active records
CREATE INDEX idx_vehicles_license_plate
  ON public.vehicles (license_plate)
  WHERE deleted_at IS NULL;

-- Composite: browse/filter vehicles by brand+model per org (catalog-style queries)
CREATE INDEX idx_vehicles_org_brand_model
  ON public.vehicles (organization_id, brand, model)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_same_org"
  ON public.vehicles
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "vehicles_insert_same_org"
  ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "vehicles_update_same_org"
  ON public.vehicles
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "vehicles_delete_same_org"
  ON public.vehicles
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
