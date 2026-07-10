
CREATE TABLE public.image_generation_styles (
  style_id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  preview_url text,
  prompt_prefix text NOT NULL DEFAULT '',
  negative_prompt text NOT NULL DEFAULT '',
  supported_types text[] NOT NULL DEFAULT ARRAY['cover','social','inline']::text[],
  display_order int NOT NULL DEFAULT 100,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.image_generation_styles TO anon, authenticated;
GRANT ALL ON public.image_generation_styles TO service_role;

ALTER TABLE public.image_generation_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read enabled styles"
  ON public.image_generation_styles FOR SELECT
  USING (is_enabled = true);

CREATE POLICY "Admins manage styles"
  ON public.image_generation_styles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.image_generation_styles
  (style_id, name, description, category, prompt_prefix, negative_prompt, supported_types, display_order) VALUES
  ('editorial-minimal', 'Editorial Minimal', 'Clean editorial cover with soft gradient and generous whitespace', 'editorial',
    'Editorial minimalist composition, soft gradient background, generous whitespace, refined typography-friendly negative space,',
    'clutter, busy background, text, watermark, low quality', ARRAY['cover','social','inline'], 10),
  ('editorial-magazine', 'Magazine Cover', 'Bold magazine-style hero with cinematic light', 'editorial',
    'Magazine cover composition, cinematic lighting, high contrast, hero subject centered,',
    'text, watermark, logo, low quality, blurry', ARRAY['cover','social'], 20),
  ('photo-documentary', 'Documentary Photo', 'Natural-light documentary photography, grounded and human', 'photography',
    'Documentary photograph, natural lighting, candid moment, 35mm film aesthetic, shallow depth of field,',
    'illustration, cartoon, 3d render, oversaturated, text', ARRAY['cover','social','inline'], 30),
  ('photo-cinematic', 'Cinematic Still', 'Cinematic still frame with anamorphic feel', 'photography',
    'Cinematic still frame, anamorphic lens flare, moody color grade, film grain,',
    'flat lighting, cartoon, clip art, text', ARRAY['cover','social'], 40),
  ('photo-product', 'Product Studio', 'Studio product photography on seamless backdrop', 'photography',
    'Studio product photography, seamless backdrop, soft box lighting, sharp focus, commercial quality,',
    'cluttered background, harsh shadows, text, watermark', ARRAY['inline','social'], 50),
  ('illustration-flat', 'Flat Illustration', 'Bold flat vector illustration, high contrast', 'illustration',
    'Bold flat vector illustration, geometric shapes, high contrast palette, thick outlines,',
    'photorealistic, 3d, gradient mesh, text, watermark', ARRAY['cover','social','inline'], 60),
  ('illustration-line', 'Line Art', 'Elegant single-weight line art on soft background', 'illustration',
    'Elegant line art illustration, single-weight strokes, minimal palette, hand-drawn feel,',
    'photo, 3d, heavy shading, text', ARRAY['cover','inline'], 70),
  ('illustration-editorial', 'Editorial Illustration', 'Conceptual editorial illustration with symbolic imagery', 'illustration',
    'Conceptual editorial illustration, symbolic composition, muted palette, textured brushwork,',
    'photo, generic clip art, text, watermark', ARRAY['cover','social'], 80),
  ('3d-claymorph', 'Claymorphic 3D', 'Soft pastel claymorphic 3D render', '3d',
    'Claymorphic 3d render, soft pastel palette, rounded forms, subtle ambient occlusion, studio lighting,',
    'photo, harsh lighting, text, watermark', ARRAY['cover','social','inline'], 90),
  ('3d-isometric', 'Isometric 3D', 'Isometric 3D scene with clean geometry', '3d',
    'Isometric 3d scene, clean geometry, soft global illumination, pastel accents,',
    'photo, chaotic composition, text', ARRAY['cover','inline'], 100),
  ('abstract-gradient', 'Abstract Gradient', 'Smooth abstract gradient composition', 'abstract',
    'Abstract gradient composition, smooth color transitions, subtle grain, generative aesthetic,',
    'literal objects, text, watermark, clutter', ARRAY['cover','social','inline'], 110),
  ('abstract-glass', 'Glass Morphism', 'Translucent glass shapes with soft light refraction', 'abstract',
    'Glass morphism composition, translucent layered shapes, soft light refraction, iridescent highlights,',
    'photo of real people, text, watermark', ARRAY['cover','social'], 120),
  ('social-quote', 'Social Quote Card', 'Square social card with strong focal shape for overlay text', 'social',
    'Square social media card composition, strong focal shape offset to one side, ample negative space for text overlay, vibrant accent color,',
    'existing text, watermark, cluttered background', ARRAY['social'], 130),
  ('social-portrait', 'Portrait Story', 'Vertical 9:16 portrait for stories and reels', 'social',
    'Vertical 9:16 portrait composition, bold subject framing, mobile-first hierarchy, punchy contrast,',
    'landscape framing, text, watermark', ARRAY['social'], 140),
  ('infographic-data', 'Data Infographic', 'Clean infographic with charts and iconography', 'infographic',
    'Clean infographic composition, labelled data visualization, iconography, structured grid, muted accent palette,',
    'photorealistic, chaotic layout, watermark', ARRAY['cover','inline'], 150);
