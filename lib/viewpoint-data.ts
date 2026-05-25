export type ViewCategory =
  | "Sunset"
  | "Night view"
  | "Car spot"
  | "Hidden gem"
  | "Date spot"
  | "Mountain view";

export type Spot = {
  id: string;
  name: string;
  city: string;
  vibe: string;
  category: ViewCategory;
  ratingAverage: number;
  ratingCount: number;
  saveCount: number;
  commentCount: number;
  mediaUrl: string;
  mediaType: "photo" | "video";
  creatorId: string;
  creatorUsername: string;
  lat: number;
  lng: number;
  geohash?: string;
  createdAt?: unknown;
};

export type Comment = {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt?: unknown;
};

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  followerCount: number;
  followingCount: number;
  spotCount: number;
  createdAt?: unknown;
};

export type Post = {
  id: string;
  spotId: string;
  userId: string;
  username: string;
  caption: string;
  mediaUrl: string;
  mediaType: "photo" | "video";
  createdAt?: unknown;
};

export const categories: ViewCategory[] = [
  "Sunset",
  "Night view",
  "Car spot",
  "Hidden gem",
  "Date spot",
  "Mountain view"
];

export const demoSpots: Spot[] = [
  {
    id: "demo-glassline",
    name: "Glassline Overlook",
    city: "Los Angeles",
    vibe: "Neon skyline after rain",
    category: "Night view",
    ratingAverage: 4.9,
    ratingCount: 842,
    saveCount: 18400,
    commentCount: 428,
    mediaUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1400&q=80",
    mediaType: "video",
    creatorId: "mira",
    creatorUsername: "mira.v",
    lat: 34.101,
    lng: -118.326
  },
  {
    id: "demo-signal",
    name: "Signal Hill Pull-Off",
    city: "Long Beach",
    vibe: "Car spot with ocean lights",
    category: "Car spot",
    ratingAverage: 4.7,
    ratingCount: 391,
    saveCount: 9100,
    commentCount: 196,
    mediaUrl: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1400&q=80",
    mediaType: "photo",
    creatorId: "jace",
    creatorUsername: "jace.drive",
    lat: 33.797,
    lng: -118.165
  },
  {
    id: "demo-canyon",
    name: "Canyon Date Deck",
    city: "Pasadena",
    vibe: "Quiet sunset bench",
    category: "Date spot",
    ratingAverage: 4.8,
    ratingCount: 514,
    saveCount: 12700,
    commentCount: 244,
    mediaUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    mediaType: "photo",
    creatorId: "ari",
    creatorUsername: "ari.finds",
    lat: 34.147,
    lng: -118.144
  },
  {
    id: "demo-switchback",
    name: "Switchback 07",
    city: "Denver",
    vibe: "Mountain air, city below",
    category: "Mountain view",
    ratingAverage: 4.6,
    ratingCount: 205,
    saveCount: 6800,
    commentCount: 102,
    mediaUrl: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1400&q=80",
    mediaType: "photo",
    creatorId: "sol",
    creatorUsername: "sol.route",
    lat: 39.739,
    lng: -104.99
  }
];

export const demoComments: Comment[] = [
  {
    id: "demo-comment-1",
    userId: "nina",
    username: "nina",
    text: "The pin is accurate. Take the second stairway, not the main entrance."
  },
  {
    id: "demo-comment-2",
    userId: "kai",
    username: "kai",
    text: "No gate, but it gets packed after 9. Go earlier."
  },
  {
    id: "demo-comment-3",
    userId: "zo",
    username: "zo",
    text: "Saved this for Friday. The photos look unreal."
  }
];

export const formatCount = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
};
