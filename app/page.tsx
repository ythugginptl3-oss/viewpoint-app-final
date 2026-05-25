"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { motion } from "framer-motion";
import {
  Bell,
  Bookmark,
  Camera,
  Car,
  ChevronRight,
  Compass,
  Heart,
  Home,
  ImagePlus,
  Loader2,
  LocateFixed,
  Map,
  MapPin,
  MessageCircle,
  Moon,
  Mountain,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Sun,
  Upload,
  UserPlus,
  Video,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { geohashForLocation } from "geofire-common";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, googleProvider, isFirebaseConfigured, storage } from "@/lib/firebase";
import {
  categories,
  demoComments,
  demoSpots,
  formatCount,
  type Comment,
  type Spot,
  type UserProfile,
  type ViewCategory
} from "@/lib/viewpoint-data";

const categoryIcons = {
  Sunset: Sun,
  "Night view": Moon,
  "Car spot": Car,
  "Hidden gem": Sparkles,
  "Date spot": Heart,
  "Mountain view": Mountain
};

const emptyProfile = (user: FirebaseUser): UserProfile => {
  const baseName = user.displayName || user.email?.split("@")[0] || "ViewPointer";
  const username = baseName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");

  return {
    uid: user.uid,
    username: username || `vp.${user.uid.slice(0, 6)}`,
    displayName: baseName,
    photoURL: user.photoURL || undefined,
    bio: "Finding the city from better angles.",
    city: "Nearby",
    followerCount: 0,
    followingCount: 0,
    spotCount: 0,
    createdAt: serverTimestamp()
  };
};

export default function HomePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [spots, setSpots] = useState<Spot[]>(demoSpots);
  const [activeSpotId, setActiveSpotId] = useState(demoSpots[0].id);
  const [comments, setComments] = useState<Comment[]>(demoComments);
  const [savedIds, setSavedIds] = useState<string[]>(["demo-glassline", "demo-canyon"]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [queryText, setQueryText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState(
    isFirebaseConfigured
      ? "Firebase connected. Sign in to post, save, follow, rate, and comment."
      : "Demo mode until Firebase keys are added."
  );
  const [showComposer, setShowComposer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSpot, setNewSpot] = useState({
    name: "",
    city: "",
    vibe: "",
    category: "Hidden gem" as ViewCategory,
    lat: "34.0522",
    lng: "-118.2437",
    mediaUrl: ""
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const activeSpot = spots.find((spot) => spot.id === activeSpotId) || spots[0];
  const isRealApp = isFirebaseConfigured && Boolean(auth && db && storage);

  useEffect(() => {
    if (!auth || !db) return;
    const liveDb = db;

    return auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setFollowingIds([]);
        setSavedIds([]);
        setStatus("Firebase connected. Sign in to post, save, follow, rate, and comment.");
        return;
      }

      const profileRef = doc(liveDb, "users", currentUser.uid);
      const profileSnap = await getDoc(profileRef);
      const nextProfile = profileSnap.exists()
        ? ({ uid: currentUser.uid, ...profileSnap.data() } as UserProfile)
        : emptyProfile(currentUser);

      if (!profileSnap.exists()) {
        await setDoc(profileRef, nextProfile);
      }
      setProfile(nextProfile);
      setStatus("Signed in. Posts, follows, saves, ratings, and comments sync to Firebase.");
    });
  }, []);

  useEffect(() => {
    if (!db || !isFirebaseConfigured) return;
    const liveDb = db;

    const spotsQuery = query(collection(liveDb, "spots"), orderBy("createdAt", "desc"), limit(60));
    return onSnapshot(spotsQuery, (snapshot) => {
      const liveSpots = snapshot.docs.map((spotDoc) => ({
        id: spotDoc.id,
        ...spotDoc.data()
      })) as Spot[];
      if (liveSpots.length) {
        setSpots(liveSpots);
        setActiveSpotId((current) => (liveSpots.some((spot) => spot.id === current) ? current : liveSpots[0].id));
      }
    });
  }, []);

  useEffect(() => {
    if (!db || !user || activeSpot.id.startsWith("demo-")) {
      setComments(demoComments);
      return;
    }
    const liveDb = db;

    const commentsQuery = query(
      collection(liveDb, "spots", activeSpot.id, "comments"),
      orderBy("createdAt", "desc"),
      limit(25)
    );
    return onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map((commentDoc) => ({ id: commentDoc.id, ...commentDoc.data() })) as Comment[]);
    });
  }, [activeSpot.id, user]);

  useEffect(() => {
    if (!db || !user) return;
    const liveDb = db;

    const savesQuery = query(collection(liveDb, "users", user.uid, "saves"));
    const followsQuery = query(collection(liveDb, "users", user.uid, "following"));
    const unlistenSaves = onSnapshot(savesQuery, (snapshot) => {
      setSavedIds(snapshot.docs.map((saveDoc) => saveDoc.id));
    });
    const unlistenFollows = onSnapshot(followsQuery, (snapshot) => {
      setFollowingIds(snapshot.docs.map((followDoc) => followDoc.id));
    });

    return () => {
      unlistenSaves();
      unlistenFollows();
    };
  }, [user]);

  const filteredSpots = useMemo(() => {
    const normalized = queryText.trim().toLowerCase();
    const ranked = [...spots].sort((a, b) => trendScore(b) - trendScore(a));
    if (!normalized) return ranked;
    return ranked.filter((spot) =>
      [spot.name, spot.city, spot.vibe, spot.category, spot.creatorUsername].some((item) =>
        item.toLowerCase().includes(normalized)
      )
    );
  }, [queryText, spots]);

  const handleSignIn = async () => {
    if (!auth || !isFirebaseConfigured) {
      setStatus("Add Firebase keys in .env.local, then restart the app to enable real accounts.");
      return;
    }
    const { signInWithPopup } = await import("firebase/auth");
    await signInWithPopup(auth, googleProvider);
  };

  const handleSignOut = async () => {
    if (!auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
    setStatus("Signed out.");
  };

  const requireUser = () => {
    if (user) return true;
    setStatus("Sign in first to post, follow, save, rate, or comment.");
    return false;
  };

  const toggleSave = async (spot: Spot) => {
    if (!db || !requireUser()) return;
    const saveRef = doc(db, "users", user!.uid, "saves", spot.id);
    const spotRef = doc(db, "spots", spot.id);
    const isSaved = savedIds.includes(spot.id);

    if (isSaved) {
      await deleteDoc(saveRef);
      if (!spot.id.startsWith("demo-")) await updateDoc(spotRef, { saveCount: increment(-1) });
      setStatus("Removed from saved spots.");
    } else {
      await setDoc(saveRef, { spotId: spot.id, createdAt: serverTimestamp() });
      if (!spot.id.startsWith("demo-")) await updateDoc(spotRef, { saveCount: increment(1) });
      setStatus("Saved to your lookout list.");
    }
  };

  const toggleFollow = async (creatorId: string) => {
    if (!db || !requireUser()) return;
    if (creatorId === user!.uid) {
      setStatus("That is your profile.");
      return;
    }

    const followRef = doc(db, "users", user!.uid, "following", creatorId);
    const followerRef = doc(db, "users", creatorId, "followers", user!.uid);
    const isFollowing = followingIds.includes(creatorId);

    if (isFollowing) {
      await deleteDoc(followRef);
      await deleteDoc(followerRef);
      setStatus("Unfollowed creator.");
    } else {
      await setDoc(followRef, { userId: creatorId, createdAt: serverTimestamp() });
      await setDoc(followerRef, { userId: user!.uid, createdAt: serverTimestamp() });
      setStatus("Following creator.");
    }
  };

  const submitRating = async (value: number) => {
    setRating(value);
    if (!db || !requireUser() || activeSpot.id.startsWith("demo-")) {
      setStatus(activeSpot.id.startsWith("demo-") ? "Demo spots are preview-only. Add a real spot to save ratings." : "Rating saved locally.");
      return;
    }

    const ratingRef = doc(db, "spots", activeSpot.id, "ratings", user!.uid);
    const spotRef = doc(db, "spots", activeSpot.id);

    await runTransaction(db, async (transaction) => {
      const spotSnap = await transaction.get(spotRef);
      const ratingSnap = await transaction.get(ratingRef);
      const spotData = spotSnap.data() as Spot;
      const oldRating = ratingSnap.exists() ? Number(ratingSnap.data().rating) : 0;
      const oldCount = Number(spotData.ratingCount || 0);
      const oldAverage = Number(spotData.ratingAverage || 0);
      const newCount = ratingSnap.exists() ? oldCount : oldCount + 1;
      const total = oldAverage * oldCount - oldRating + value;
      transaction.set(ratingRef, { rating: value, userId: user!.uid, createdAt: serverTimestamp() });
      transaction.update(spotRef, {
        ratingAverage: Number((total / newCount).toFixed(2)),
        ratingCount: newCount
      });
    });
    setStatus("Rating synced.");
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    if (!db || !requireUser() || activeSpot.id.startsWith("demo-")) {
      setComments((current) => [
        {
          id: crypto.randomUUID(),
          userId: "demo",
          username: profile?.username || "you",
          text: commentText
        },
        ...current
      ]);
      setCommentText("");
      setStatus("Comment previewed. Add Firebase and a real spot to sync comments.");
      return;
    }

    await addDoc(collection(db, "spots", activeSpot.id, "comments"), {
      userId: user!.uid,
      username: profile?.username || "viewpointer",
      text: commentText,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "spots", activeSpot.id), { commentCount: increment(1) });
    setCommentText("");
    setStatus("Comment posted.");
  };

  const createSpot = async () => {
    if (!db || !storage || !requireUser()) return;
    setIsSaving(true);
    try {
      let mediaUrl = newSpot.mediaUrl;
      const lat = Number(newSpot.lat);
      const lng = Number(newSpot.lng);

      if (mediaFile) {
        const fileRef = ref(storage, `spots/${user!.uid}/${Date.now()}-${mediaFile.name}`);
        await uploadBytes(fileRef, mediaFile);
        mediaUrl = await getDownloadURL(fileRef);
      }

      if (!mediaUrl) {
        mediaUrl = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80";
      }

      await addDoc(collection(db, "spots"), {
        name: newSpot.name || "Untitled ViewPoint",
        city: newSpot.city || "Unknown city",
        vibe: newSpot.vibe || "A hidden city view",
        category: newSpot.category,
        lat,
        lng,
        geohash: geohashForLocation([lat, lng]),
        mediaUrl,
        mediaType: mediaFile?.type.startsWith("video") ? "video" : "photo",
        creatorId: user!.uid,
        creatorUsername: profile?.username || "viewpointer",
        ratingAverage: 0,
        ratingCount: 0,
        saveCount: 0,
        commentCount: 0,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "users", user!.uid), { spotCount: increment(1) });
      setShowComposer(false);
      setNewSpot({ name: "", city: "", vibe: "", category: "Hidden gem", lat: "34.0522", lng: "-118.2437", mediaUrl: "" });
      setMediaFile(null);
      setStatus("New ViewPoint is live.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden pb-24 text-white lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-acid text-ink shadow-glow">
            <Compass className="h-6 w-6" />
          </div>
          <div className="mr-auto">
            <p className="text-xl font-black tracking-normal">ViewPoint</p>
            <p className="text-xs text-white/50">real spots, social ratings, city views</p>
          </div>
          <SearchBox value={queryText} onChange={setQueryText} className="hidden min-w-[24rem] md:flex" />
          <button
            onClick={user ? handleSignOut : handleSignIn}
            className="hidden rounded-full border border-line px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-white/25 hover:text-white sm:block"
          >
            {user ? profile?.username || "Account" : "Sign in"}
          </button>
          <button
            onClick={() => (user ? setShowComposer(true) : handleSignIn())}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-acid"
          >
            <Plus className="h-4 w-4" />
            Add spot
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_25rem] lg:px-8">
        <div className="grid gap-5">
          <SearchBox value={queryText} onChange={setQueryText} className="md:hidden" />

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <HeroSpot spot={activeSpot} saved={savedIds.includes(activeSpot.id)} onSave={() => toggleSave(activeSpot)} />

            <aside className="glass grid content-between gap-5 rounded-[8px] p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white/55">Creator profile</p>
                    <h2 className="mt-1 truncate text-2xl font-black">@{activeSpot.creatorUsername}</h2>
                  </div>
                  <button
                    onClick={() => toggleFollow(activeSpot.creatorId)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-ink transition hover:bg-acid"
                    aria-label="Follow creator"
                  >
                    {followingIds.includes(activeSpot.creatorId) ? <Heart className="h-6 w-6 fill-ink" /> : <UserPlus className="h-6 w-6" />}
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Spots", profile?.spotCount ?? 0],
                    ["Followers", profile?.followerCount ?? 0],
                    ["Following", profile?.followingCount ?? 0]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[8px] bg-white/[0.06] p-3">
                      <p className="text-lg font-black">{value}</p>
                      <p className="text-xs text-white/45">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-line bg-ink/55 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">Rate this lookout</p>
                  <span className="text-sm text-white/45">{rating}.0</span>
                </div>
                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => submitRating(value)}
                      aria-label={`Rate ${value} stars`}
                      className="rounded-[8px] p-1 transition hover:bg-white/10"
                    >
                      <Star className={`h-8 w-8 ${value <= rating ? "fill-acid text-acid" : "text-white/25"}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-line bg-ink/55 p-4">
                <p className="mb-3 font-bold">Upload memory</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowComposer(true)} className="flex items-center justify-center gap-2 rounded-[8px] bg-white/[0.08] px-3 py-3 text-sm font-bold transition hover:bg-white/[0.14]">
                    <Camera className="h-4 w-4" />
                    Photo
                  </button>
                  <button onClick={() => setShowComposer(true)} className="flex items-center justify-center gap-2 rounded-[8px] bg-white/[0.08] px-3 py-3 text-sm font-bold transition hover:bg-white/[0.14]">
                    <Video className="h-4 w-4" />
                    Video
                  </button>
                </div>
              </div>

              <button onClick={() => setShowComposer(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-acid px-5 py-3 font-black text-ink transition hover:bg-white">
                <Upload className="h-4 w-4" />
                Post a new ViewPoint
              </button>
            </aside>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="glass rounded-[8px] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white/55">Live city map</p>
                  <h2 className="text-2xl font-black">Lookout pins</h2>
                </div>
                <button className="rounded-full bg-white/[0.08] p-3 transition hover:bg-white/[0.14]" aria-label="Find near me">
                  <LocateFixed className="h-5 w-5" />
                </button>
              </div>
              <SpotMap spots={filteredSpots} activeSpot={activeSpot} onSelect={setActiveSpotId} />
            </div>

            <div className="glass rounded-[8px] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white/55">Comments</p>
                  <h2 className="text-2xl font-black">{activeSpot.commentCount}</h2>
                </div>
                <MessageCircle className="h-6 w-6 text-acid" />
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {comments.map((comment, index) => (
                  <CommentCard key={comment.id} comment={comment} highlighted={index === 0} />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-white/[0.06] p-2">
                <input
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-white/35"
                  placeholder="Add a comment"
                />
                <button onClick={submitComment} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acid text-ink" aria-label="Send comment">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="grid gap-5 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <section className="glass rounded-[8px] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white/55">Discover by vibe</p>
                <h2 className="text-2xl font-black">Categories</h2>
              </div>
              <Sparkles className="h-6 w-6 text-acid" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => {
                const Icon = categoryIcons[category];
                return (
                  <button
                    key={category}
                    onClick={() => setQueryText(category)}
                    className="flex items-center gap-2 rounded-[8px] border border-line bg-white/[0.05] p-3 text-left text-sm font-bold transition hover:border-acid/60 hover:bg-acid/10"
                  >
                    <Icon className="h-4 w-4 text-acid" />
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass rounded-[8px] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white/55">For you</p>
                <h2 className="text-2xl font-black">Trending spots</h2>
              </div>
              <ChevronRight className="h-6 w-6 text-white/45" />
            </div>
            <div className="space-y-3">
              {filteredSpots.map((spot, index) => (
                <button
                  key={spot.id}
                  onClick={() => setActiveSpotId(spot.id)}
                  className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 rounded-[8px] p-2 text-left transition hover:bg-white/[0.07]"
                >
                  <div className="relative h-20 overflow-hidden rounded-[8px]">
                    <img src={spot.mediaUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] font-black">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black">{spot.name}</p>
                    <p className="truncate text-sm text-white/48">{spot.city} · {spot.category}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-acid">
                      <Star className="h-3 w-3 fill-acid" />
                      {spot.ratingAverage || "New"}
                    </div>
                  </div>
                  <Bookmark className={`h-5 w-5 ${savedIds.includes(spot.id) ? "fill-acid text-acid" : "text-white/30"}`} />
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[8px] border border-acid/30 bg-acid p-4 text-ink shadow-glow">
            <div className="flex items-center gap-3">
              <ImagePlus className="h-8 w-8" />
              <div>
                <h2 className="text-xl font-black">Real app status</h2>
                <p className="text-sm font-semibold text-ink/70">{status}</p>
              </div>
            </div>
          </section>
        </aside>
      </section>

      {showComposer ? (
        <ComposerModal
          newSpot={newSpot}
          setNewSpot={setNewSpot}
          setMediaFile={setMediaFile}
          onClose={() => setShowComposer(false)}
          onCreate={createSpot}
          isSaving={isSaving}
          isRealApp={isRealApp}
        />
      ) : null}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-ink/90 px-5 py-3 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 text-white/55">
          {[
            [Home, "Home"],
            [Search, "Search"],
            [Plus, "Add"],
            [Map, "Map"],
            [Bell, "Alerts"]
          ].map(([Icon, label]) => (
            <button key={String(label)} onClick={() => label === "Add" && setShowComposer(true)} className="flex flex-col items-center gap-1 text-[0.68rem] font-bold">
              <Icon className={`h-5 w-5 ${label === "Home" ? "text-acid" : ""}`} />
              {label as string}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function SearchBox({ value, onChange, className = "" }: { value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <div className={`items-center gap-2 rounded-full border border-line bg-white/[0.06] px-4 py-3 ${className}`}>
      <Search className="h-4 w-4 text-white/45" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
        placeholder="Search city, creator, or vibe"
      />
    </div>
  );
}

function HeroSpot({ spot, saved, onSave }: { spot: Spot; saved: boolean; onSave: () => void }) {
  return (
    <motion.article initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative min-h-[31rem] overflow-hidden rounded-[8px] border border-line bg-panel shadow-soft">
      <img src={spot.mediaUrl} alt={spot.name} className="absolute inset-0 h-full w-full object-cover" />
      <div className="media-shine absolute inset-0" />
      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
        <span className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur">Trending near me</span>
        <button onClick={onSave} aria-label="Save active spot" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 backdrop-blur transition hover:bg-black/70">
          <Bookmark className={`h-5 w-5 ${saved ? "fill-acid text-acid" : "text-white"}`} />
        </button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-10 p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-acid px-3 py-1 text-xs font-black text-ink">#{spot.category}</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{spot.city}</span>
          {spot.mediaType === "video" ? (
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Play className="h-3.5 w-3.5 fill-white" />
              short video
            </span>
          ) : null}
        </div>
        <h1 className="max-w-3xl text-4xl font-black leading-[0.96] tracking-normal sm:text-6xl">{spot.name}</h1>
        <p className="mt-3 max-w-xl text-base text-white/76 sm:text-lg">{spot.vibe} in {spot.city}. Rated, saved, and commented on by locals.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Metric icon={<Star className="h-4 w-4 fill-acid text-acid" />} label={spot.ratingAverage ? String(spot.ratingAverage) : "New"} />
          <Metric icon={<MessageCircle className="h-4 w-4" />} label={`${formatCount(spot.commentCount)} comments`} />
          <Metric icon={<Bookmark className="h-4 w-4" />} label={`${formatCount(spot.saveCount)} saves`} />
        </div>
      </div>
    </motion.article>
  );
}

function Metric({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="flex items-center gap-2 rounded-full bg-black/38 px-4 py-2 text-sm font-black backdrop-blur">{icon}{label}</span>;
}

function SpotMap({ spots, activeSpot, onSelect }: { spots: Spot[]; activeSpot: Spot; onSelect: (id: string) => void }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<unknown>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    let markers: { remove: () => void }[] = [];

    async function renderMap() {
      if (!token || !mapRef.current) return;
      const mapboxgl = await import("mapbox-gl");
      mapboxgl.default.accessToken = token;
      if (!mapInstance.current) {
        mapInstance.current = new mapboxgl.default.Map({
          container: mapRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [activeSpot.lng, activeSpot.lat],
          zoom: 10.4
        });
      }
      const map = mapInstance.current as InstanceType<typeof mapboxgl.default.Map>;
      map.flyTo({ center: [activeSpot.lng, activeSpot.lat], zoom: 11, essential: true });
      markers = spots.map((spot) => {
        const el = document.createElement("button");
        el.className = `h-9 w-9 rounded-full border-4 border-black ${spot.id === activeSpot.id ? "bg-[#c7ff4f]" : "bg-white"} shadow-lg`;
        el.onclick = () => onSelect(spot.id);
        return new mapboxgl.default.Marker(el).setLngLat([spot.lng, spot.lat]).addTo(map);
      });
    }

    renderMap();
    return () => markers.forEach((marker) => marker.remove());
  }, [activeSpot, onSelect, spots, token]);

  if (token) {
    return <div ref={mapRef} className="min-h-[25rem] overflow-hidden rounded-[8px] border border-line bg-[#0d1113]" />;
  }

  return (
    <div className="map-grid relative min-h-[25rem] overflow-hidden rounded-[8px] border border-line bg-[#0d1113]">
      <div className="absolute left-0 top-[48%] h-14 w-full rotate-[-10deg] bg-white/[0.055]" />
      <div className="absolute left-[30%] top-0 h-full w-12 rotate-[24deg] bg-white/[0.045]" />
      <div className="absolute bottom-4 left-4 rounded-full bg-black/50 px-3 py-2 text-xs font-bold backdrop-blur">{activeSpot.lat.toFixed(3)}, {activeSpot.lng.toFixed(3)}</div>
      {spots.map((spot, index) => (
        <button
          key={spot.id}
          onClick={() => onSelect(spot.id)}
          className="group absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${18 + ((index * 23) % 64)}%`, top: `${24 + ((index * 31) % 48)}%` }}
          aria-label={`Open ${spot.name}`}
        >
          <span className={`flex h-12 w-12 items-center justify-center rounded-full border-4 border-black text-ink shadow-glow transition group-hover:scale-110 ${activeSpot.id === spot.id ? "bg-acid" : "bg-white"}`}>
            <MapPin className="h-6 w-6 fill-current" />
          </span>
        </button>
      ))}
    </div>
  );
}

function CommentCard({ comment, highlighted = false }: { comment: Comment; highlighted?: boolean }) {
  return (
    <div className={`rounded-[8px] p-3 ${highlighted ? "bg-acid text-ink" : "bg-white/[0.06]"}`}>
      <p className="text-sm font-black">@{comment.username}</p>
      <p className={`mt-1 text-sm ${highlighted ? "text-ink/75" : "text-white/62"}`}>{comment.text}</p>
    </div>
  );
}

function ComposerModal({
  newSpot,
  setNewSpot,
  setMediaFile,
  onClose,
  onCreate,
  isSaving,
  isRealApp
}: {
  newSpot: { name: string; city: string; vibe: string; category: ViewCategory; lat: string; lng: string; mediaUrl: string };
  setNewSpot: (value: { name: string; city: string; vibe: string; category: ViewCategory; lat: string; lng: string; mediaUrl: string }) => void;
  setMediaFile: (file: File | null) => void;
  onClose: () => void;
  onCreate: () => void;
  isSaving: boolean;
  isRealApp: boolean;
}) {
  const update = (field: keyof typeof newSpot, value: string) =>
    setNewSpot({ ...newSpot, [field]: value } as typeof newSpot);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/70 p-3 backdrop-blur sm:place-items-center">
      <div className="glass w-full max-w-2xl rounded-[8px] p-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white/55">Create a public lookout</p>
            <h2 className="text-2xl font-black">New ViewPoint</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/[0.08] p-2" aria-label="Close composer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Spot name" value={newSpot.name} onChange={(value) => update("name", value)} placeholder="Elysian ridge turnout" />
          <Field label="City" value={newSpot.city} onChange={(value) => update("city", value)} placeholder="Los Angeles" />
          <Field label="Latitude" value={newSpot.lat} onChange={(value) => update("lat", value)} placeholder="34.0522" />
          <Field label="Longitude" value={newSpot.lng} onChange={(value) => update("lng", value)} placeholder="-118.2437" />
          <label className="grid gap-2 text-sm font-bold text-white/70">
            Category
            <select value={newSpot.category} onChange={(event) => update("category", event.target.value)} className="rounded-[8px] border border-line bg-ink px-3 py-3 text-white outline-none">
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <Field label="Image/video URL" value={newSpot.mediaUrl} onChange={(value) => update("mediaUrl", value)} placeholder="Optional if uploading a file" />
          <label className="grid gap-2 text-sm font-bold text-white/70 sm:col-span-2">
            Vibe
            <textarea value={newSpot.vibe} onChange={(event) => update("vibe", event.target.value)} className="min-h-24 rounded-[8px] border border-line bg-ink px-3 py-3 text-white outline-none placeholder:text-white/35" placeholder="Describe the view, access tip, time of day, parking, mood..." />
          </label>
          <label className="grid gap-2 rounded-[8px] border border-dashed border-white/20 bg-white/[0.04] p-4 text-sm font-bold text-white/70 sm:col-span-2">
            Upload photo or short video
            <input type="file" accept="image/*,video/*" onChange={(event) => setMediaFile(event.target.files?.[0] || null)} className="text-sm text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-acid file:px-4 file:py-2 file:font-black file:text-ink" />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/50">{isRealApp ? "This will publish to Firebase and appear for everyone." : "Add Firebase keys first to publish real posts."}</p>
          <button onClick={onCreate} disabled={isSaving || !isRealApp} className="flex items-center justify-center gap-2 rounded-full bg-acid px-5 py-3 font-black text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publish spot
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-white/70">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-[8px] border border-line bg-ink px-3 py-3 text-white outline-none placeholder:text-white/35" placeholder={placeholder} />
    </label>
  );
}

function trendScore(spot: Spot) {
  return spot.saveCount * 3 + spot.commentCount * 2 + spot.ratingCount * 4 + spot.ratingAverage * 10;
}
