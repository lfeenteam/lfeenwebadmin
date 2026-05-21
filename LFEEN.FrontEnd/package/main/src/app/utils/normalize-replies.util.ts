import { Post } from "../pages/apps/profile-content/profileData";


export function normalizeReplies(posts: Post[]): Post[] {
    return posts.map((post) => ({
      ...post,
      data: {
        ...post.data,
        comments: post.data.comments.map((comment) => ({
          ...comment,
          data: {
            ...comment.data,
            replies: (comment.data.replies ?? []).map((reply) => ({
              ...reply,
              data: {
                ...reply.data,
                replies: reply.data.replies ?? [],
              },
            })),
          },
        })),
      },
    }));
  }