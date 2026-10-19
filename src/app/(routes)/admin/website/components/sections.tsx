'use client';

// One editor per tab of the Website page. Every editor gets the whole content
// and a setter for one section; nothing is saved until "Save changes".
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Loader2 } from 'lucide-react';
import { apiErrorMessage, formatRs, storeApi } from '@/lib/storeApi';
import { Field, HelpBox, Toggle, inputClass, secondaryBtn } from '@/components/admin/FormBits';
import { Grid2, IconPicker, ImageField, ListEditor, SectionCard, TextField, UrlField, useEditor } from './fields';
import { ICONS, type EditableContent, type IconItem, type OfferItem, type SectionKey, type TabKey } from './types';

export type SetSection = <K extends SectionKey>(key: K, value: EditableContent[K]) => void;
interface TabProps {
  c: EditableContent;
  set: SetSection;
}

const or = (s: string, fallback: string) => (s.trim() ? s : fallback);

// ------------------------------------------------------------------ Home
function HomeTab({ c, set }: TabProps) {
  const brand = c.brand;
  const hero = c.hero;
  const setHero = (patch: Partial<EditableContent['hero']>) => set('hero', { ...hero, ...patch });
  return (
    <>
      <SectionCard title="Brand" subtitle="Your shop name and one short line about it." section="brand">
        <Grid2>
          <TextField label="Shop name" value={brand.name} onChange={(v) => set('brand', { ...brand, name: v })} />
          <TextField label="Tagline" value={brand.tagline} onChange={(v) => set('brand', { ...brand, tagline: v })} />
        </Grid2>
      </SectionCard>

      <SectionCard title="Top of the page" subtitle="The first thing people see: big heading, picture and buttons." section="hero">
        <TextField label="Heading" value={hero.heading} onChange={(v) => setHero({ heading: v })} />
        <TextField label="Subheading" kind="text" rows={2} value={hero.subheading} onChange={(v) => setHero({ subheading: v })} />
        <ImageField
          label="Main picture"
          value={hero.imageUrl}
          onChange={(v) => setHero({ imageUrl: v })}
          hint="A wide (landscape) photo of the shop works best."
        />
        <UrlField
          label="Video (optional)"
          value={hero.videoUrl}
          onChange={(v) => setHero({ videoUrl: v })}
          placeholder="https://…/shop.mp4"
          hint="A link to an .mp4 video. It is shown below the main picture."
        />
        <Grid2>
          <TextField
            label="Main button text"
            value={hero.primaryCta.label}
            onChange={(v) => setHero({ primaryCta: { ...hero.primaryCta, label: v } })}
          />
          <UrlField
            label="Main button link"
            value={hero.primaryCta.url}
            onChange={(v) => setHero({ primaryCta: { ...hero.primaryCta, url: v } })}
            placeholder="#visit"
            hint="#visit jumps to the Visit us section. A full https:// link also works."
          />
          <TextField
            label="Second button text"
            value={hero.secondaryCta.label}
            onChange={(v) => setHero({ secondaryCta: { ...hero.secondaryCta, label: v } })}
          />
          <UrlField
            label="Second button link"
            value={hero.secondaryCta.url}
            onChange={(v) => setHero({ secondaryCta: { ...hero.secondaryCta, url: v } })}
            hint="Leave empty to open your Facebook page (set it under Social & SEO)."
          />
        </Grid2>
      </SectionCard>
    </>
  );
}

// ------------------------------------------------------------------ Who we are
function AboutTab({ c, set }: TabProps) {
  const s = c.about;
  const up = (patch: Partial<typeof s>) => set('about', { ...s, ...patch });
  return (
    <SectionCard title="Who we are" subtitle="Tell people about the shop in your own words." section="about" show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      <TextField label="Text" kind="body" value={s.body} onChange={(v) => up({ body: v })} hint="Leave an empty line between paragraphs." />
      <ImageField label="Picture (optional)" value={s.imageUrl} onChange={(v) => up({ imageUrl: v })} />
    </SectionCard>
  );
}

// ------------------------------------------------------------------ What we do / What you get
function IconItemsTab({ c, set, section, title, subtitle }: TabProps & { section: 'whatWeDo' | 'whatYouGet'; title: string; subtitle: string }) {
  const { limits } = useEditor();
  const s = c[section];
  const up = (patch: Partial<typeof s>) => set(section, { ...s, ...patch });
  return (
    <SectionCard title={title} subtitle={subtitle} section={section} show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      <TextField label="Intro (optional)" kind="text" rows={2} value={s.intro} onChange={(v) => up({ intro: v })} />
      <ListEditor<IconItem>
        items={s.items}
        onChange={(items) => up({ items })}
        max={limits.items}
        newItem={() => ({ icon: 'star', title: '', text: '' })}
        itemTitle={(it) => `${(ICONS[it.icon] || ICONS.star).label} · ${or(it.title, 'New point')}`}
        addLabel="Add a point"
        emptyText="No points yet."
      >
        {(it, setIt) => (
          <>
            <IconPicker value={it.icon} onChange={(icon) => setIt({ icon })} />
            <TextField label="Title" value={it.title} onChange={(v) => setIt({ title: v })} />
            <TextField label="Text" kind="text" rows={2} value={it.text} onChange={(v) => setIt({ text: v })} />
          </>
        )}
      </ListEditor>
    </SectionCard>
  );
}

// ------------------------------------------------------------------ Prices
function PricesTab({ c, set }: TabProps) {
  const { canEdit, limits } = useEditor();
  const s = c.prices;
  const up = (patch: Partial<typeof s>) => set('prices', { ...s, ...patch });
  return (
    <SectionCard title="Prices" subtitle="Your fixed price points (in rupees)." section="prices" show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      <TextField label="Intro (optional)" kind="text" rows={2} value={s.intro} onChange={(v) => up({ intro: v })} />
      <ListEditor
        items={s.items}
        onChange={(items) => up({ items })}
        max={limits.items}
        newItem={() => ({ price: 0, label: '', note: '' })}
        itemTitle={(it) => `${formatRs(it.price)}${it.label ? ` · ${it.label}` : ''}`}
        addLabel="Add a price"
        emptyText="No prices yet."
      >
        {(it, setIt) => (
          <>
            <Grid2>
              <Field label="Price (Rs)">
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  className={inputClass}
                  value={Number.isFinite(it.price) ? String(it.price) : ''}
                  onChange={(e) => setIt({ price: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                  disabled={!canEdit}
                />
              </Field>
              <TextField label="Label (optional)" value={it.label} onChange={(v) => setIt({ label: v })} placeholder="e.g. Kitchen basics" />
            </Grid2>
            <TextField label="Note (optional)" kind="text" rows={2} value={it.note} onChange={(v) => setIt({ note: v })} />
          </>
        )}
      </ListEditor>
    </SectionCard>
  );
}

// ------------------------------------------------------------------ Categories
function CategoriesTab({ c, set }: TabProps) {
  const { limits } = useEditor();
  const s = c.categories;
  const up = (patch: Partial<typeof s>) => set('categories', { ...s, ...patch });
  return (
    <SectionCard title="Categories" subtitle="The kinds of things people find in the shop." section="categories" show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      <ListEditor
        items={s.items}
        onChange={(items) => up({ items })}
        max={limits.items}
        newItem={() => ({ name: '', text: '', imageUrl: '' })}
        itemTitle={(it) => or(it.name, 'New category')}
        addLabel="Add a category"
        emptyText="No categories yet."
      >
        {(it, setIt) => (
          <>
            <TextField label="Name" value={it.name} onChange={(v) => setIt({ name: v })} />
            <TextField label="Short text (optional)" kind="text" rows={2} value={it.text} onChange={(v) => setIt({ text: v })} />
            <ImageField compact label="Picture (optional)" value={it.imageUrl} onChange={(v) => setIt({ imageUrl: v })} />
          </>
        )}
      </ListEditor>
    </SectionCard>
  );
}

// ------------------------------------------------------------------ Offers
const todayPkt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
function offerStatus(o: OfferItem): string {
  if (!o.active) return 'switched off';
  const today = todayPkt();
  if (o.startsOn && today < o.startsOn) return 'starts later';
  if (o.endsOn && today > o.endsOn) return 'ended';
  return 'showing';
}

function OffersTab({ c, set }: TabProps) {
  const { canEdit, limits } = useEditor();
  const s = c.offers;
  const up = (patch: Partial<typeof s>) => set('offers', { ...s, ...patch });
  return (
    <SectionCard title="Offers" subtitle="Deals and promotions." section="offers" show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      <HelpBox>
        An offer is shown only while it is <strong>active</strong> and today is between its dates (Pakistan time). Leave a date empty
        for no limit.
      </HelpBox>
      <ListEditor<OfferItem>
        items={s.items}
        onChange={(items) => up({ items })}
        max={limits.items}
        newItem={() => ({ title: '', text: '', imageUrl: '', active: true, startsOn: '', endsOn: '' })}
        itemTitle={(it) => `${or(it.title, 'New offer')} · ${offerStatus(it)}`}
        addLabel="Add an offer"
        emptyText="No offers yet."
      >
        {(it, setIt) => (
          <>
            <TextField label="Title" value={it.title} onChange={(v) => setIt({ title: v })} />
            <TextField label="Text" kind="text" rows={2} value={it.text} onChange={(v) => setIt({ text: v })} />
            <ImageField compact label="Picture (optional)" value={it.imageUrl} onChange={(v) => setIt({ imageUrl: v })} />
            <Toggle checked={it.active} onChange={(v) => setIt({ active: v })} label="Active" disabled={!canEdit} />
            <Grid2>
              <Field label="Starts on (optional)">
                <input type="date" className={inputClass} value={it.startsOn} onChange={(e) => setIt({ startsOn: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label="Ends on (optional)">
                <input
                  type="date"
                  className={inputClass}
                  value={it.endsOn}
                  min={it.startsOn || undefined}
                  onChange={(e) => setIt({ endsOn: e.target.value })}
                  disabled={!canEdit}
                />
              </Field>
            </Grid2>
          </>
        )}
      </ListEditor>
    </SectionCard>
  );
}

// ------------------------------------------------------------------ Gallery
function GalleryTab({ c, set }: TabProps) {
  const { canEdit, limits } = useEditor();
  const s = c.gallery;
  const up = (patch: Partial<typeof s>) => set('gallery', { ...s, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Several pictures at once: each becomes a new gallery item.
  const uploadMany = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = limits.galleryItems - s.items.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (list.length < files.length) toast.error(`The gallery holds ${limits.galleryItems} pictures; extra ones were skipped.`);
    const added: { imageUrl: string; caption: string }[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        setUploading(`${i + 1} / ${list.length}`);
        const f = list[i];
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) {
          toast.error(`${f.name}: use a JPG, PNG or WebP picture up to 5 MB`);
          continue;
        }
        const form = new FormData();
        form.append('file', f);
        const res = await storeApi.upload<{ url: string }>('/website/upload', form);
        added.push({ imageUrl: res.data.url, caption: '' });
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not upload a picture.'));
    } finally {
      if (added.length) {
        up({ items: [...s.items, ...added] });
        toast.success(`${added.length} picture${added.length === 1 ? '' : 's'} added. Save changes to publish.`);
      }
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <SectionCard title="Gallery" subtitle="Photos of the shop, racks and products." section="gallery" show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      {canEdit && (
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => uploadMany(e.target.files)}
          />
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => fileRef.current?.click()}
            disabled={!!uploading || s.items.length >= limits.galleryItems}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? `Uploading ${uploading}` : 'Upload several pictures'}
          </button>
        </div>
      )}
      <ListEditor
        items={s.items}
        onChange={(items) => up({ items })}
        max={limits.galleryItems}
        newItem={() => ({ imageUrl: '', caption: '' })}
        itemTitle={(it) => or(it.caption, it.imageUrl ? 'Picture' : 'No picture yet')}
        addLabel="Add a picture"
        emptyText="No pictures yet."
      >
        {(it, setIt) => (
          <>
            <ImageField compact label="Picture" value={it.imageUrl} onChange={(v) => setIt({ imageUrl: v })} />
            <TextField label="Caption (optional)" kind="text" rows={2} value={it.caption} onChange={(v) => setIt({ caption: v })} />
          </>
        )}
      </ListEditor>
    </SectionCard>
  );
}

// ------------------------------------------------------------------ FAQ
function FaqTab({ c, set }: TabProps) {
  const { limits } = useEditor();
  const s = c.faq;
  const up = (patch: Partial<typeof s>) => set('faq', { ...s, ...patch });
  return (
    <SectionCard title="Questions (FAQ)" subtitle="Answers to what customers often ask." section="faq" show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      <ListEditor
        items={s.items}
        onChange={(items) => up({ items })}
        max={limits.items}
        newItem={() => ({ q: '', a: '' })}
        itemTitle={(it) => or(it.q, 'New question')}
        addLabel="Add a question"
        emptyText="No questions yet."
      >
        {(it, setIt) => (
          <>
            <TextField label="Question" kind="text" rows={2} value={it.q} onChange={(v) => setIt({ q: v })} />
            <TextField label="Answer" kind="text" rows={3} value={it.a} onChange={(v) => setIt({ a: v })} />
          </>
        )}
      </ListEditor>
    </SectionCard>
  );
}

// ------------------------------------------------------------------ Visit us
const isMapEmbed = (u: string) => /^https:\/\/www\.google\.com\/maps\/embed\?/.test(u);

function VisitTab({ c, set }: TabProps) {
  const s = c.visit;
  const up = (patch: Partial<typeof s>) => set('visit', { ...s, ...patch });
  // People often paste the whole <iframe> code: keep just its src.
  const setMap = (v: string) => {
    const m = /src\s*=\s*["']([^"']+)["']/i.exec(v);
    up({ mapEmbedUrl: (m ? m[1].replace(/&amp;/g, '&') : v).trim() });
  };
  return (
    <SectionCard title="Visit us" subtitle="Where the shop is and how to reach you. Empty fields are not shown." section="visit" show={s.show} onShow={(v) => up({ show: v })}>
      <TextField label="Heading" value={s.heading} onChange={(v) => up({ heading: v })} />
      <Grid2>
        <TextField label="Address" kind="text" rows={2} value={s.address} onChange={(v) => up({ address: v })} />
        <TextField label="City" value={s.city} onChange={(v) => up({ city: v })} />
        <TextField label="Opening hours" kind="text" rows={3} value={s.hours} onChange={(v) => up({ hours: v })} placeholder={'Mon – Sun: 10 am – 10 pm'} />
        <div className="space-y-3">
          <TextField label="Phone" value={s.phone} onChange={(v) => up({ phone: v })} inputMode="tel" placeholder="0300 1234567" />
          <TextField
            label="WhatsApp number"
            value={s.whatsapp}
            onChange={(v) => up({ whatsapp: v })}
            inputMode="tel"
            placeholder="923001234567"
            hint="With country code (92…). 0300 1234567 also works."
          />
        </div>
        <TextField label="Email" value={s.email} onChange={(v) => up({ email: v.trim() })} inputMode="email" placeholder="shop@example.com" />
      </Grid2>

      <UrlField
        label="Google Maps embed link"
        value={s.mapEmbedUrl}
        onChange={setMap}
        placeholder="https://www.google.com/maps/embed?pb=…"
        hint={
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>Open Google Maps and find your shop.</li>
            <li>
              Tap <strong>Share</strong> → <strong>Embed a map</strong> → <strong>Copy HTML</strong>.
            </li>
            <li>Paste it here. We keep only the link (the part after src=).</li>
          </ol>
        }
      />
      {isMapEmbed(s.mapEmbedUrl) && (
        <iframe
          src={s.mapEmbedUrl}
          title="Map preview"
          className="w-full h-48 rounded-lg border border-gray-200"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
      <UrlField
        label="Google Maps link (for directions)"
        value={s.mapLinkUrl}
        onChange={(v) => up({ mapLinkUrl: v })}
        placeholder="https://maps.app.goo.gl/…"
        hint="Google Maps → Share → Copy link. Opens directions on the phone."
      />
    </SectionCard>
  );
}

// ------------------------------------------------------------------ Social & SEO
function SocialTab({ c, set }: TabProps) {
  const { canEdit } = useEditor();
  const so = c.social;
  const seo = c.seo;
  const upSo = (patch: Partial<typeof so>) => set('social', { ...so, ...patch });
  const upSeo = (patch: Partial<typeof seo>) => set('seo', { ...seo, ...patch });
  return (
    <>
      <SectionCard title="Website address" subtitle="Where the website lives on the internet.">
        <UrlField
          label="Website address"
          value={c.siteUrl}
          onChange={(v) => set('siteUrl', v)}
          placeholder="https://dollarandco.pk"
          hint="Used by the View website button. Also put this address on your Facebook page: Edit page → Contact info → Website."
        />
      </SectionCard>

      <SectionCard title="Social links" subtitle="Your pages on social media. Empty links are not shown." section="social">
        <UrlField
          label="Facebook page"
          value={so.facebookUrl}
          onChange={(v) => upSo({ facebookUrl: v })}
          placeholder="https://www.facebook.com/yourpage"
          hint="Open your Facebook page and copy the address from the browser bar (on the phone: ⋯ → Copy link)."
        />
        <Toggle
          checked={so.showFacebookFeed}
          onChange={(v) => upSo({ showFacebookFeed: v })}
          disabled={!canEdit}
          label="Show Facebook page feed on the website"
          hint="Shows your latest Facebook posts on the website. Needs the Facebook page link above."
        />
        <Grid2>
          <UrlField label="Instagram" value={so.instagramUrl} onChange={(v) => upSo({ instagramUrl: v })} placeholder="https://www.instagram.com/…" />
          <UrlField label="TikTok" value={so.tiktokUrl} onChange={(v) => upSo({ tiktokUrl: v })} placeholder="https://www.tiktok.com/@…" />
          <UrlField label="YouTube" value={so.youtubeUrl} onChange={(v) => upSo({ youtubeUrl: v })} placeholder="https://www.youtube.com/@…" />
        </Grid2>
      </SectionCard>

      <SectionCard title="Google & sharing (SEO)" subtitle="How the website looks in Google and when the link is shared." section="seo">
        <TextField label="Page title" value={seo.title} onChange={(v) => upSeo({ title: v })} hint="Shown in Google results and the browser tab." />
        <TextField
          label="Description"
          kind="text"
          rows={3}
          value={seo.description}
          onChange={(v) => upSeo({ description: v })}
          hint={`Shown under the title in Google and on Facebook / WhatsApp shares. About 150 characters is best (now ${seo.description.length}).`}
        />
        <ImageField
          label="Share picture"
          value={seo.ogImageUrl}
          onChange={(v) => upSeo({ ogImageUrl: v })}
          hint="Shown when the link is shared on Facebook or WhatsApp. Best size 1200 × 630."
        />
        <TextField label="Keywords (optional)" kind="text" rows={2} value={seo.keywords} onChange={(v) => upSeo({ keywords: v })} hint="Words people may search for, separated by commas." />
      </SectionCard>
    </>
  );
}

// ------------------------------------------------------------------ switch
export function TabEditor({ tab, c, set }: TabProps & { tab: TabKey }) {
  switch (tab) {
    case 'home':
      return <HomeTab c={c} set={set} />;
    case 'about':
      return <AboutTab c={c} set={set} />;
    case 'whatWeDo':
      return <IconItemsTab c={c} set={set} section="whatWeDo" title="What we do" subtitle="What the shop offers, in a few short points." />;
    case 'whatYouGet':
      return <IconItemsTab c={c} set={set} section="whatYouGet" title="What you get" subtitle="Why people should shop with you." />;
    case 'prices':
      return <PricesTab c={c} set={set} />;
    case 'categories':
      return <CategoriesTab c={c} set={set} />;
    case 'offers':
      return <OffersTab c={c} set={set} />;
    case 'gallery':
      return <GalleryTab c={c} set={set} />;
    case 'faq':
      return <FaqTab c={c} set={set} />;
    case 'visit':
      return <VisitTab c={c} set={set} />;
    case 'social':
      return <SocialTab c={c} set={set} />;
    default:
      return null;
  }
}
