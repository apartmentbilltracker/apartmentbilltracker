-- Create ads table for promotional content
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500) NOT NULL,
  button_text VARCHAR(100) DEFAULT 'Learn More',
  button_link VARCHAR(500),
  
  -- Display settings
  display_on TEXT[] DEFAULT '{"client"}', -- ['client', 'host', 'admin'] or combination
  display_screen VARCHAR(50) DEFAULT 'home', -- home, payment, history, settlement, etc
  
  -- Date range
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Status and priority
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher number = higher priority (displayed first)
  
  -- Analytics
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  
  -- Dismissal tracking
  dismissible BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_ads_active_screen ON ads(is_active, display_screen, priority DESC);
CREATE INDEX idx_ads_display_on ON ads USING GIN(display_on);

-- Create ad impressions tracking table
CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_click BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for impressions
CREATE INDEX idx_ad_impressions_ad_id ON ad_impressions(ad_id);
CREATE INDEX idx_ad_impressions_user_id ON ad_impressions(user_id);
CREATE INDEX idx_ad_impressions_viewed_at ON ad_impressions(viewed_at);

-- Create dismissed ads tracking table (for user dismissals)
CREATE TABLE IF NOT EXISTS dismissed_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ad_id, user_id)
);

-- Create index for dismissed ads
CREATE INDEX idx_dismissed_ads_user_id ON dismissed_ads(user_id);
CREATE INDEX idx_dismissed_ads_ad_id ON dismissed_ads(ad_id);
