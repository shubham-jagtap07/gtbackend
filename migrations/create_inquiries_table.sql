-- Create inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(255),
    subject VARCHAR(500),
    message TEXT,
    source VARCHAR(20) DEFAULT 'popup' CHECK (source IN ('popup', 'contact')),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'resolved', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_source ON inquiries(source);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inquiries_updated_at
    BEFORE UPDATE ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_inquiries_updated_at();
