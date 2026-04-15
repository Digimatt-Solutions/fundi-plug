import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Heart, MessageCircle, Send, Image as ImageIcon, Megaphone, Trash2,
  MoreHorizontal, Clock, PenLine, Plus,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.png";

interface Post {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  post_type: string;
  likes_count: number;
  created_at: string;
  author?: { name: string; avatar_url: string | null };
  author_role?: string;
  comments: Comment[];
  liked: boolean;
}

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { name: string; avatar_url: string | null };
}

interface Blog {
  id: string;
  author_id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  blog_type: string;
  created_at: string;
}

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Blog form state (admin only)
  const [showBlogForm, setShowBlogForm] = useState(false);
  const [blogTitle, setBlogTitle] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [blogImage, setBlogImage] = useState<File | null>(null);
  const [blogImagePreview, setBlogImagePreview] = useState<string | null>(null);
  const [blogType, setBlogType] = useState<"blog" | "advert">("blog");
  const [postingBlog, setPostingBlog] = useState(false);
  const blogFileRef = useRef<HTMLInputElement>(null);

  const loadPosts = async () => {
    if (!user) return;
    const { data: postsData } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!postsData || postsData.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const authorIds = [...new Set(postsData.map(p => p.author_id))];
    const [profilesRes, rolesRes, likesRes, commentsRes] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_url").in("id", authorIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", authorIds),
      supabase.from("community_likes").select("post_id").eq("user_id", user.id),
      supabase.from("community_comments").select("*").in("post_id", postsData.map(p => p.id)).order("created_at", { ascending: true }),
    ]);

    const profileMap: Record<string, any> = {};
    (profilesRes.data || []).forEach(p => { profileMap[p.id] = p; });
    const roleMap: Record<string, string> = {};
    (rolesRes.data || []).forEach(r => { roleMap[r.user_id] = r.role; });
    const likedPostIds = new Set((likesRes.data || []).map(l => l.post_id));

    const commentAuthorIds = [...new Set((commentsRes.data || []).map(c => c.author_id))];
    const missingIds = commentAuthorIds.filter(id => !profileMap[id]);
    if (missingIds.length > 0) {
      const { data: moreProfiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", missingIds);
      (moreProfiles || []).forEach(p => { profileMap[p.id] = p; });
    }

    const commentsByPost: Record<string, Comment[]> = {};
    (commentsRes.data || []).forEach(c => {
      if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
      commentsByPost[c.post_id].push({
        ...c,
        author: profileMap[c.author_id] || { name: "User", avatar_url: null },
      });
    });

    setPosts(postsData.map(p => ({
      ...p,
      author: profileMap[p.author_id] || { name: "User", avatar_url: null },
      author_role: roleMap[p.author_id] || "customer",
      comments: commentsByPost[p.id] || [],
      liked: likedPostIds.has(p.id),
    })));
    setLoading(false);
  };

  const loadBlogs = async () => {
    const { data } = await supabase
      .from("community_blogs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setBlogs((data as Blog[]) || []);
  };

  useEffect(() => {
    loadPosts();
    loadBlogs();
    const channel = supabase.channel("community-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_likes" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_blogs" }, () => loadBlogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setNewImage(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const createPost = async () => {
    if (!user || !newContent.trim()) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (newImage) {
      const ext = newImage.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("community-images").upload(path, newImage);
      if (uploadErr) { toast({ title: "Image upload failed", description: uploadErr.message, variant: "destructive" }); setPosting(false); return; }
      const { data: urlData } = supabase.storage.from("community-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
    const { error } = await supabase.from("community_posts").insert({
      author_id: user.id, content: newContent.trim(), image_url: imageUrl,
      post_type: isAnnouncement && user.role === "admin" ? "announcement" : "post",
    } as any);
    if (error) { toast({ title: "Failed to post", description: error.message, variant: "destructive" }); }
    else { setNewContent(""); setNewImage(null); setImagePreview(null); setIsAnnouncement(false); }
    setPosting(false);
  };

  // Optimistic like toggle
  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;
    const currentCount = posts.find(p => p.id === postId)?.likes_count ?? 0;
    const newCount = liked ? Math.max(0, currentCount - 1) : currentCount + 1;
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, liked: !liked, likes_count: newCount } : p
    ));
    if (liked) {
      await supabase.from("community_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      await supabase.from("community_posts").update({ likes_count: newCount } as any).eq("id", postId);
    } else {
      await supabase.from("community_likes").insert({ post_id: postId, user_id: user.id } as any);
      await supabase.from("community_posts").update({ likes_count: newCount } as any).eq("id", postId);
    }
  };

  const addComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text || !user) return;
    // Optimistic: add comment instantly
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      id: tempId, post_id: postId, author_id: user.id, content: text,
      created_at: new Date().toISOString(),
      author: { name: user.name, avatar_url: user.avatar_url || null },
    };
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, optimisticComment] } : p
    ));
    setCommentTexts(prev => ({ ...prev, [postId]: "" }));
    await supabase.from("community_comments").insert({ post_id: postId, author_id: user.id, content: text } as any);
  };

  const deletePost = async (postId: string) => {
    await supabase.from("community_posts").delete().eq("id", postId);
    toast({ title: "Post deleted" });
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("community_comments").delete().eq("id", commentId);
  };

  // Blog CRUD (admin)
  const createBlog = async () => {
    if (!user || !blogTitle.trim()) return;
    setPostingBlog(true);
    let imageUrl: string | null = null;
    if (blogImage) {
      const ext = blogImage.name.split(".").pop();
      const path = `blogs/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("community-images").upload(path, blogImage);
      if (uploadErr) { toast({ title: "Image upload failed", variant: "destructive" }); setPostingBlog(false); return; }
      const { data: urlData } = supabase.storage.from("community-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
    await supabase.from("community_blogs").insert({ author_id: user.id, title: blogTitle.trim(), content: blogContent.trim() || null, image_url: imageUrl, blog_type: blogType } as any);
    setBlogTitle(""); setBlogContent(""); setBlogImage(null); setBlogImagePreview(null); setShowBlogForm(false);
    setPostingBlog(false);
  };

  const deleteBlog = async (id: string) => {
    await supabase.from("community_blogs").delete().eq("id", id);
    toast({ title: "Removed" });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary">Admin</span>;
      case "worker": return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-600">Fundi</span>;
      default: return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-600">Client</span>;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
          <img src={logo} alt="FundiPlug" className="w-7 h-7 rounded-lg object-cover" /> Community
        </h1>
        <p className="text-muted-foreground text-sm">Share ideas, fun facts, and connect with the FundiPlug community</p>
      </div>

      <div className="flex gap-6">
        {/* Feed - 3/4 */}
        <div className="flex-1 min-w-0 space-y-5" style={{ flex: "3" }}>
          {/* Composer */}
          <div className="stat-card space-y-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{user?.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                  placeholder="What's on your mind? Share a tip, fun fact, or update..."
                  className="bg-muted/30 border-muted min-h-[80px] resize-none focus:bg-background transition-colors" />
                {imagePreview && (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="max-h-48 rounded-xl object-cover" />
                    <button onClick={() => { setNewImage(null); setImagePreview(null); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80">✕</button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary gap-1.5" onClick={() => fileRef.current?.click()}>
                      <ImageIcon className="w-4 h-4" /> Photo
                    </Button>
                    {user?.role === "admin" && (
                      <Button variant={isAnnouncement ? "default" : "ghost"} size="sm"
                        className={`gap-1.5 ${isAnnouncement ? "" : "text-muted-foreground hover:text-primary"}`}
                        onClick={() => setIsAnnouncement(!isAnnouncement)}>
                        <Megaphone className="w-4 h-4" /> Announcement
                      </Button>
                    )}
                  </div>
                  <Button size="sm" onClick={createPost} disabled={posting || !newContent.trim()} className="gap-1.5 px-5">
                    <Send className="w-3.5 h-3.5" /> {posting ? "Posting..." : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Posts */}
          {posts.length === 0 ? (
            <div className="stat-card text-center py-16 space-y-3">
              <img src={logo} alt="FundiPlug" className="w-12 h-12 mx-auto rounded-xl object-cover opacity-50" />
              <p className="font-medium text-foreground">No posts yet</p>
              <p className="text-sm text-muted-foreground">Be the first to share something with the community!</p>
            </div>
          ) : (
            posts.map((post, i) => (
              <div key={post.id}
                className={`stat-card space-y-3 animate-fade-in ${post.post_type === "announcement" ? "border-primary/30 bg-primary/[0.02]" : ""}`}
                style={{ animationDelay: `${i * 40}ms` }}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={post.author?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{post.author?.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{post.author?.name}</span>
                        {getRoleBadge(post.author_role || "customer")}
                        {post.post_type === "announcement" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary flex items-center gap-0.5">
                            <Megaphone className="w-3 h-3" /> Announcement
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeAgo(post.created_at)}
                      </span>
                    </div>
                  </div>
                  {(post.author_id === user?.id || user?.role === "admin") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => deletePost(post.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Post
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>
                {post.image_url && (
                  <img src={post.image_url} alt="Post" className="w-full rounded-xl max-h-96 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => setPreviewImage(post.image_url)} />
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 pt-1 border-t border-border/50">
                  <button onClick={() => toggleLike(post.id, post.liked)}
                    className={`flex items-center gap-1.5 text-sm transition-colors py-1.5 ${post.liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}>
                    <Heart className={`w-4 h-4 transition-transform ${post.liked ? "fill-current scale-110" : ""}`} />
                    <span className="font-medium">{post.likes_count}</span>
                  </button>
                  <button onClick={() => setExpandedComments(prev => {
                    const n = new Set(prev); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n;
                  })} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors py-1.5">
                    <MessageCircle className="w-4 h-4" /> <span className="font-medium">{post.comments.length}</span>
                  </button>
                </div>

                {/* Comments */}
                {expandedComments.has(post.id) && (
                  <div className="space-y-3 pl-2">
                    {post.comments.map(c => (
                      <div key={c.id} className="flex items-start gap-2.5 group">
                        <Avatar className="w-7 h-7 mt-0.5">
                          <AvatarImage src={c.author?.avatar_url || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{c.author?.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted/40 rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">{c.author?.name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                              {(c.author_id === user?.id || user?.role === "admin") && (
                                <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-foreground mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={user?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{user?.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <Input value={commentTexts[post.id] || ""}
                        onChange={e => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addComment(post.id)}
                        placeholder="Write a comment..." className="h-8 text-xs bg-muted/30 rounded-full" />
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => addComment(post.id)} disabled={!commentTexts[post.id]?.trim()}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sidebar - 1/4 Blogs & Adverts */}
        <div className="hidden md:block space-y-4" style={{ flex: "1", minWidth: "220px", maxWidth: "300px" }}>
          <div className="sticky top-4 space-y-4">
            {/* Admin: Add Blog/Advert */}
            {user?.role === "admin" && (
              <div className="stat-card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <PenLine className="w-4 h-4 text-primary" /> Manage Content
                  </h3>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowBlogForm(!showBlogForm)}>
                    <Plus className={`w-4 h-4 transition-transform ${showBlogForm ? "rotate-45" : ""}`} />
                  </Button>
                </div>
                {showBlogForm && (
                  <div className="space-y-2.5">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant={blogType === "blog" ? "default" : "outline"} className="text-xs h-7 flex-1" onClick={() => setBlogType("blog")}>Blog</Button>
                      <Button size="sm" variant={blogType === "advert" ? "default" : "outline"} className="text-xs h-7 flex-1" onClick={() => setBlogType("advert")}>Advert</Button>
                    </div>
                    <Input value={blogTitle} onChange={e => setBlogTitle(e.target.value)} placeholder="Title" className="h-8 text-xs" />
                    {blogType === "blog" && (
                      <Textarea value={blogContent} onChange={e => setBlogContent(e.target.value)} placeholder="Write content..." className="text-xs min-h-[60px] resize-none" />
                    )}
                    <input type="file" ref={blogFileRef} accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setBlogImage(f); setBlogImagePreview(URL.createObjectURL(f)); }
                    }} />
                    {blogImagePreview ? (
                      <div className="relative">
                        <img src={blogImagePreview} alt="Preview" className="w-full h-24 rounded-lg object-cover" />
                        <button onClick={() => { setBlogImage(null); setBlogImagePreview(null); }}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">✕</button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1" onClick={() => blogFileRef.current?.click()}>
                        <ImageIcon className="w-3 h-3" /> Add Image
                      </Button>
                    )}
                    <Button size="sm" className="w-full text-xs h-8" onClick={createBlog} disabled={postingBlog || !blogTitle.trim()}>
                      {postingBlog ? "Publishing..." : "Publish"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Blog/Advert Feed */}
            {blogs.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Blogs & Adverts</h3>
                {blogs.map(b => (
                  <div key={b.id} className="stat-card space-y-2 group relative">
                    {user?.role === "admin" && (
                      <button onClick={() => deleteBlog(b.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {b.image_url && (
                      <img src={b.image_url} alt={b.title}
                        className="w-full h-28 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewImage(b.image_url)} />
                    )}
                    <div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${b.blog_type === "advert" ? "text-primary" : "text-green-600"}`}>
                        {b.blog_type === "advert" ? "Ad" : "Blog"}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground leading-tight">{b.title}</h4>
                      {b.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{b.content}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1.5">{timeAgo(b.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="stat-card text-center py-8 space-y-2">
                <img src={logo} alt="FundiPlug" className="w-8 h-8 mx-auto rounded-lg object-cover opacity-40" />
                <p className="text-xs text-muted-foreground">No blogs or adverts yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader><DialogTitle className="sr-only">Image Preview</DialogTitle></DialogHeader>
          {previewImage && <img src={previewImage} alt="Preview" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
