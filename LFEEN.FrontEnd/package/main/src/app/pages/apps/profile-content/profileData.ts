import Chance from 'chance';

export interface Post {
  id: string;
  profile: {
    id: string;
    avatar: string;
    name: string;
    time: string;
  };
  data: {
    content: string;
    images: {
      img: string;
      featured?: boolean;
      title?: string;
    }[];
    video?: string;
    likes: {
      like: boolean;
      value: number;
    };
    comments: PostComment[];
  };
}

export interface PostComment {
  id: string;
  profile: {
    id: string;
    avatar: string;
    name: string;
    time: string;
  };
  data: {
    comment: string;
    likes: {
      like: boolean;
      value: number;
    };
    replies: PostComment[];
  };
}

interface topcards {
  img: string;
}

const chance = new Chance();

export const mockPosts: Post[] = [
  {
    id: '1',
    profile: {
      id: '2',
      avatar: 'assets/images/profile/user-10.jpg',
      name: 'Macky Dawn',
      time: '15 min ago',
    },
    data: {
      content: chance.paragraph({ sentences: 2 }),
      images: [
        {
          img: 'assets/images/products/s1.jpg',
          featured: true,
        },
      ],
      likes: {
        like: true,
        value: 67,
      },
      comments: [
        {
          id: '3',
          profile: {
            id: '4',
            avatar: 'assets/images/profile/user-3.jpg',
            name: 'Deran Mac',
            time: '8 min ago ',
          },
          data: {
            comment: chance.paragraph({ sentences: 2 }),
            likes: {
              like: true,
              value: 55,
            },
            replies: [],
          },
        },
        {
          id: '5',
          profile: {
            id: '6',
            avatar: 'assets/images/profile/user-8.jpg',
            name: 'Jonathan Bg',
            time: '5 min ago ',
          },
          data: {
            comment: chance.paragraph({ sentences: 2 }),
            likes: {
              like: false,
              value: 68,
            },
            replies: [
              {
                id: '7',
                profile: {
                  id: '8',
                  avatar: 'assets/images/profile/user-2.jpg',
                  name: 'Carry minati',
                  time: 'just now ',
                },
                data: {
                  comment: chance.paragraph({ sentences: 2 }),
                  likes: {
                    like: true,
                    value: 10,
                  },
                  replies: [],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    id: '9',
    profile: {
      id: '10',
      avatar: 'assets/images/profile/user-2.jpg',
      name: 'Carry Minati',
      time: 'now',
    },
    data: {
      content: chance.paragraph({ sentences: 2 }),
      images: [],
      likes: {
        like: true,
        value: 1,
      },
      comments: [],
    },
  },
  {
    id: '11',
    profile: {
      id: '12',
      avatar: 'assets/images/profile/user-2.jpg',
      name: 'Genelia Desouza',
      time: '15 min ago ',
    },
    data: {
      content: chance.paragraph({ sentences: 2 }),
      images: [
        {
          img: 'assets/images/products/s2.jpg',
          title: 'Image Title',
        },
        {
          img: 'assets/images/products/s4.jpg',
          title: 'Painter',
        },
      ],
      likes: {
        like: false,
        value: 320,
      },
      comments: [
        {
          id: '13',
          profile: {
            id: '14',
            avatar: 'assets/images/profile/user-3.jpg',
            name: 'Ritesh Deshmukh',
            time: '15 min ago ',
          },
          data: {
            comment: chance.paragraph({ sentences: 2 }),
            likes: {
              like: true,
              value: 65,
            },
            replies: [],
          },
        },
      ],
    },
  },
  {
    id: '15',
    profile: {
      id: '16',
      avatar: 'assets/images/profile/user-6.jpg',
      name: 'Himesh R',
      time: '15 min ago ',
    },
    data: {
      content: chance.paragraph({ sentences: 2 }),
      images: [],
      video: 'dQw4w9WgXcQ',
      likes: {
        like: true,
        value: 129,
      },
      comments: [],
    },
  },
];

export const topcards: topcards[] = [
  {
    img: 'assets/images/profile/user-1.jpg',
  },
  {
    img: 'assets/images/profile/user-2.jpg',
  },
  {
    img: 'assets/images/profile/user-3.jpg',
  },
  {
    img: 'assets/images/profile/user-4.jpg',
  },
  {
    img: 'assets/images/profile/user-5.jpg',
  },
  {
    img: 'assets/images/profile/user-6.jpg',
  },
  {
    img: 'assets/images/profile/user-7.jpg',
  },
  {
    img: 'assets/images/profile/user-8.jpg',
  },
  {
    img: 'assets/images/profile/user-9.jpg',
  },
];
