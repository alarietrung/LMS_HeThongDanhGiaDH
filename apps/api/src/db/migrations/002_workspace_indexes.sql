CREATE INDEX IF NOT EXISTS idx_files_section_visibility ON file_assets(section_id,visibility,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_replies_ticket ON support_replies(ticket_id,created_at);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_imports_actor ON learning_imports(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_review ON quiz_attempts(quiz_id,status,submitted_at);
