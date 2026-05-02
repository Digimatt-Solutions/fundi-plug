import { useEffect, useState } from "react";
import { Heart, MessageCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface PostItem {
  id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  created_at: string;
  author: { name: string; avatar_url: string | null };
  comments_count: number;
  liked: boolean;
}

export default function LatestPostsWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: postsData } = await supabase
      .from("community_posts")
      .select("id, content, image_url, likes_count, created_at, author_id")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!postsData || postsData.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const authorIds = [...new Set(postsData.map((p: any) => p.author_id))];
    const postIds = postsData.map((p: any) => p.id);

    const [profilesRes, commentsRes, likesRes] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_url").in("id", authorIds),
      supabase.from("community_comments").select("post_id").in("post_id", postIds),
      user ? supabase.from("community_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap: Record<string, any> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = p; });
    const commentCounts: Record<string, number> = {};
    (commentsRes.data || []).forEach((c: any) => { commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1; });
    const likedSet = new Set(((likesRes as any).data || []).map((l: any) => l.post_id));

    setPosts(postsData.map((p: any) => ({
      id: p.id,
      content: p.content,
      image_url: p.image_url,
      likes_count: p.likes_count || 0,
      created_at: p.created_at,
      author: profileMap[p.author_id] || { name: "User", avatar_url: null },
      comments_count: commentCounts[p.id] || 0,
      liked: likedSet.has(p.id),
    })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("widget-community-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_likes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggleLike = async (e: React.MouseEvent, post: PostItem) => {
    e.stopPropagation();
    if (!user) { navigate("/dashboard/community"); return; }
    const liked = post.liked;
    const newCount = liked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked: !liked, likes_count: newCount } : p));
    if (liked) {
      await supabase.from("community_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("community_likes").insert({ post_id: post.id, user_id: user.id } as any);
    }
    await supabase.from("community_posts").update({ likes_count: newCount } as any).eq("id", post.id);
  };

  if (loading || posts.length === 0) return null;

  return (
    <div className="animate-fade-in" style={{ animationDelay: "500ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> {t("Latest from Community")}
        </h2>
        <button
          onClick={() => navigate("/dashboard/community")}
          className="text-xs font-medium text-primary hover:underline"
        >
          {t("View all")}
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin -mx-1 px-1 snap-x snap-mandatory">
        {posts.map((p) => {
          const initials = p.author.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div
              key={p.id}
              onClick={() => navigate("/dashboard/community")}
              className="snap-start shrink-0 w-64 sm:w-72 stat-card cursor-pointer hover:border-primary/40 transition-colors flex flex-col"
            >
              <div className="flex items-center gap-2 mb-2">
                {p.author.avatar_url ? (
                  <img loading="lazy" decoding="async" src={p.author.avatar_url} alt={p.author.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">{initials}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{p.author.name}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {p.image_url && (
                <img loading="lazy" decoding="async" src={p.image_url} alt="" className="w-full h-28 object-cover rounded-lg mb-2" />
              )}
              <p className="text-sm text-foreground line-clamp-3 flex-1">{p.content}</p>
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border text-xs">
                <button
                  onClick={(e) => toggleLike(e, p)}
                  className={`flex items-center gap-1 transition-colors ${p.liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
                  aria-label="Like"
                >
                  <Heart className={`w-3.5 h-3.5 ${p.liked ? "fill-current" : ""}`} />
                  <span>{p.likes_count}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/dashboard/community"); }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                  aria-label="Comments"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{p.comments_count}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
