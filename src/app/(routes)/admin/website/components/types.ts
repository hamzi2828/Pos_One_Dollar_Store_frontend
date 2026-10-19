// Shape of the marketing website content (pos_backend/docs/WEBSITE_CMS.md §1).
import type { LucideIcon } from 'lucide-react';
import {
  Clock,
  CookingPot,
  Flower2,
  Gift,
  Heart,
  Home,
  Package,
  PenLine,
  Percent,
  ShieldCheck,
  Smile,
  Sparkles,
  SprayCan,
  Star,
  Store,
  Tag,
  ToyBrick,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';

export interface Cta {
  label: string;
  url: string;
}
export interface IconItem {
  icon: string;
  title: string;
  text: string;
}
export interface PriceItem {
  price: number;
  label: string;
  note: string;
}
export interface CategoryItem {
  name: string;
  text: string;
  imageUrl: string;
}
export interface OfferItem {
  title: string;
  text: string;
  imageUrl: string;
  active: boolean;
  /** 'YYYY-MM-DD' or '' */
  startsOn: string;
  endsOn: string;
}
export interface GalleryItem {
  imageUrl: string;
  caption: string;
}
export interface FaqItem {
  q: string;
  a: string;
}

export interface SiteContent {
  brand: { name: string; tagline: string };
  hero: { heading: string; subheading: string; imageUrl: string; videoUrl: string; primaryCta: Cta; secondaryCta: Cta };
  about: { show: boolean; heading: string; body: string; imageUrl: string };
  whatWeDo: { show: boolean; heading: string; intro: string; items: IconItem[] };
  whatYouGet: { show: boolean; heading: string; intro: string; items: IconItem[] };
  prices: { show: boolean; heading: string; intro: string; items: PriceItem[] };
  categories: { show: boolean; heading: string; items: CategoryItem[] };
  offers: { show: boolean; heading: string; items: OfferItem[] };
  gallery: { show: boolean; heading: string; items: GalleryItem[] };
  faq: { show: boolean; heading: string; items: FaqItem[] };
  visit: {
    show: boolean;
    heading: string;
    address: string;
    city: string;
    mapEmbedUrl: string;
    mapLinkUrl: string;
    hours: string;
    phone: string;
    whatsapp: string;
    email: string;
  };
  social: { facebookUrl: string; instagramUrl: string; tiktokUrl: string; youtubeUrl: string; showFacebookFeed: boolean };
  seo: { title: string; description: string; ogImageUrl: string; keywords: string };
  siteUrl: string;
  updatedAt: string | null;
  updatedByName?: string;
}

/** Everything that is saved (no updatedAt / updatedByName). */
export type EditableContent = Omit<SiteContent, 'updatedAt' | 'updatedByName'>;
/** A key that POST /website/reset accepts. */
export type SectionKey = keyof EditableContent;

export interface Limits {
  line: number;
  text: number;
  body: number;
  url: number;
  items: number;
  galleryItems: number;
}

export interface WebsiteMeta {
  icons: string[];
  defaults: EditableContent;
  limits: Limits;
}

export const DEFAULT_LIMITS: Limits = { line: 120, text: 1500, body: 5000, url: 2000, items: 24, galleryItems: 40 };

/** Fixed icon keys -> lucide icons (the website maps the same keys). */
export const ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  store: { Icon: Store, label: 'Shop' },
  tag: { Icon: Tag, label: 'Price tag' },
  wallet: { Icon: Wallet, label: 'Wallet' },
  gift: { Icon: Gift, label: 'Gift' },
  sparkles: { Icon: Sparkles, label: 'New' },
  home: { Icon: Home, label: 'Home' },
  kitchen: { Icon: CookingPot, label: 'Kitchen' },
  toys: { Icon: ToyBrick, label: 'Toys' },
  beauty: { Icon: Flower2, label: 'Beauty' },
  stationery: { Icon: PenLine, label: 'Stationery' },
  cleaning: { Icon: SprayCan, label: 'Cleaning' },
  truck: { Icon: Truck, label: 'Delivery' },
  clock: { Icon: Clock, label: 'Time' },
  heart: { Icon: Heart, label: 'Heart' },
  star: { Icon: Star, label: 'Star' },
  smile: { Icon: Smile, label: 'Smile' },
  shield: { Icon: ShieldCheck, label: 'Quality' },
  users: { Icon: Users, label: 'People' },
  package: { Icon: Package, label: 'Stock' },
  percent: { Icon: Percent, label: 'Offer' },
};
export const ICON_KEYS = Object.keys(ICONS);

export type TabKey =
  | 'home'
  | 'about'
  | 'whatWeDo'
  | 'whatYouGet'
  | 'prices'
  | 'categories'
  | 'offers'
  | 'gallery'
  | 'faq'
  | 'visit'
  | 'social';

export const TABS: { key: TabKey; label: string; sections: SectionKey[] }[] = [
  { key: 'home', label: 'Home', sections: ['brand', 'hero'] },
  { key: 'about', label: 'Who we are', sections: ['about'] },
  { key: 'whatWeDo', label: 'What we do', sections: ['whatWeDo'] },
  { key: 'whatYouGet', label: 'What you get', sections: ['whatYouGet'] },
  { key: 'prices', label: 'Prices', sections: ['prices'] },
  { key: 'categories', label: 'Categories', sections: ['categories'] },
  { key: 'gallery', label: 'Gallery', sections: ['gallery'] },
  { key: 'faq', label: 'Questions (FAQ)', sections: ['faq'] },
  { key: 'visit', label: 'Visit us', sections: ['visit'] },
  { key: 'social', label: 'Social & SEO', sections: ['social', 'seo', 'siteUrl'] },
];

/** Strip the fields the server sets itself, so "changed?" compares only what the owner edits. */
export function editable(c: SiteContent): EditableContent {
  const rest: Partial<SiteContent> = { ...c };
  delete rest.updatedAt;
  delete rest.updatedByName;
  return rest as EditableContent;
}
