-- Add entity_id foreign key
ALTER TABLE impact_records
ADD COLUMN entity_id uuid REFERENCES entities(id) ON DELETE SET NULL;

-- Add event_id foreign key
ALTER TABLE impact_records
ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE SET NULL;

-- Indexes for query performance
CREATE INDEX idx_impact_records_entity_id ON impact_records(entity_id);
CREATE INDEX idx_impact_records_event_id ON impact_records(event_id);

