-- Seed Public Guilds based on PREMADE_JOURNEYS
-- master_id is NULL for these system guilds

INSERT INTO public.guilds (name, description, category, is_public, member_count)
VALUES
    -- Software Development
    ('Full-Stack Web Developers', 'React, Next.js, & TypeScript focus', 'Software Development', true, 0),
    ('Backend Systems Engineers', 'Python, Go, or Java architecture', 'Software Development', true, 0),
    ('Mobile App Developers', 'Cross-platform iOS & Android', 'Software Development', true, 0),
    ('Cloud Infrastructure Engineers', 'AWS/Azure & DevOps', 'Software Development', true, 0),

    -- AI & Data Science
    ('AI Integrations Engineers', 'LLMs, RAG, & Agentic Workflows', 'AI & Data Science', true, 0),
    ('Data Scientists', 'Statistical Modeling & Machine Learning', 'AI & Data Science', true, 0),
    ('Business Intelligence Analysts', 'Data Visualization & SQL', 'AI & Data Science', true, 0),
    ('Machine Learning Ops (MLOps)', 'Scaling & Deploying AI', 'AI & Data Science', true, 0),

    -- Cybersecurity
    ('Ethical Hackers', 'Offensive Security & Pen-Testing', 'Cybersecurity', true, 0),
    ('Security Operations Analysts', 'Defensive Monitoring (SOC)', 'Cybersecurity', true, 0),
    ('Cloud Security Architects', 'Securing Enterprise Infrastructure', 'Cybersecurity', true, 0),
    ('Incident Response Specialists', 'Threat Hunting & Recovery', 'Cybersecurity', true, 0),

    -- Business & Strategy
    ('Growth Marketing Managers', 'SEO, SEM, & Funnel Optimization', 'Business & Strategy', true, 0),
    ('Digital Product Managers', 'Lifecycle & Strategy', 'Business & Strategy', true, 0),
    ('Technical SaaS Founders', 'Product-Led Growth & Launch', 'Business & Strategy', true, 0),
    ('Operations Strategy Consultants', 'Process Automation & Scaling', 'Business & Strategy', true, 0)
ON CONFLICT DO NOTHING; -- Idempotency check (name is not unique constraint by DB, but we want to avoid duplicates if re-run. Actually DB constraint wasn't unique index, just validation. Use Name check?)

-- To make it strictly idempotent without a unique constraint, we can use WHERE NOT EXISTS
-- But standard INSERT VALUES doesn't support that easily for bulk.
-- Let's try to be safe:

-- Effectively this loop ensures we don't duplicate if they exist by exact name.
DO $$
DECLARE
    guild_data record;
BEGIN
    FOR guild_data IN SELECT * FROM (VALUES
        ('Full-Stack Web Developers', 'React, Next.js, & TypeScript focus', 'Software Development'),
        ('Backend Systems Engineers', 'Python, Go, or Java architecture', 'Software Development'),
        ('Mobile App Developers', 'Cross-platform iOS & Android', 'Software Development'),
        ('Cloud Infrastructure Engineers', 'AWS/Azure & DevOps', 'Software Development'),
        ('AI Integrations Engineers', 'LLMs, RAG, & Agentic Workflows', 'AI & Data Science'),
        ('Data Scientists', 'Statistical Modeling & Machine Learning', 'AI & Data Science'),
        ('Business Intelligence Analysts', 'Data Visualization & SQL', 'AI & Data Science'),
        ('Machine Learning Ops (MLOps)', 'Scaling & Deploying AI', 'AI & Data Science'),
        ('Ethical Hackers', 'Offensive Security & Pen-Testing', 'Cybersecurity'),
        ('Security Operations Analysts', 'Defensive Monitoring (SOC)', 'Cybersecurity'),
        ('Cloud Security Architects', 'Securing Enterprise Infrastructure', 'Cybersecurity'),
        ('Incident Response Specialists', 'Threat Hunting & Recovery', 'Cybersecurity'),
        ('Growth Marketing Managers', 'SEO, SEM, & Funnel Optimization', 'Business & Strategy'),
        ('Digital Product Managers', 'Lifecycle & Strategy', 'Business & Strategy'),
        ('Technical SaaS Founders', 'Product-Led Growth & Launch', 'Business & Strategy'),
        ('Operations Strategy Consultants', 'Process Automation & Scaling', 'Business & Strategy')
    ) AS t(name, description, category)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.guilds WHERE name = guild_data.name) THEN
            INSERT INTO public.guilds (name, description, category, is_public, member_count)
            VALUES (guild_data.name, guild_data.description, guild_data.category, true, 0);
        END IF;
    END LOOP;
END $$;
