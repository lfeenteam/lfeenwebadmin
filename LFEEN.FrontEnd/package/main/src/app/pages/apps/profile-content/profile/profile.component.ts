import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild,
} from '@angular/core';


import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { MaterialModule } from 'src/app/material.module';
import { IconModule } from 'src/app/icon/icon.module';
// import { Post } from 'src/app/data-types/post.model';
// import { mockPosts } from 'src/app/data-types/mock-posts';
import { normalizeReplies } from 'src/app/utils/normalize-replies.util';
import { mockPosts, Post, topcards } from '../profileData';

// interface topcards {
//   img: string;
// }


@Component({
  selector: 'app-profile',
  imports: [MaterialModule,IconModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  constructor(private sanitizer: DomSanitizer) {}
  topcards = topcards;
  posts: Post[] = mockPosts;
  transformedPosts: Post[] = [];
  ngOnInit(): void {
    this.groupImages();
    this.posts = normalizeReplies(mockPosts);
  }
  openFilePicker() {
    if (this.fileInput) {
      this.fileInput.nativeElement.click(); // Triggers the file picker
    }
  }

  // Handling file selection
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (files && files.length > 0) {
      console.log('Selected file:', files[0]);
      // Handle file (e.g., upload or display preview)
    }
  }

  groupedTopcards: any[] = [];
  groupImages() {
    const chunkSize = 3;
    for (let i = 0; i < this.topcards.length; i += chunkSize) {
      this.groupedTopcards.push(this.topcards.slice(i, i + chunkSize));
    }
  }
  trackByPost(index: number, post: any): string {
    return post.id; // or any unique identifier from your post object
  }

  hasFeaturedImages(post: Post): boolean {
    return post.data.images.some(
      (img) => 'featured' in img && img.featured === true
    );
  }

  getFeaturedImages(post: Post): { img: string }[] {
    return post.data.images.filter(
      (img) => 'featured' in img && img.featured === true
    );
  }

  hasOtherImages(post: Post): boolean {
    return post.data.images.some((img) => !('featured' in img));
  }

  getOtherImages(post: Post): { img: string }[] {
    return post.data.images.filter((img) => !('featured' in img));
  }
  getSafeVideoUrl(videoUrl: string): SafeResourceUrl {
    const videoId = videoUrl.split('?')[0]; // Just in case there's any query parameters
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://www.youtube.com/embed/' + videoId
    );
  }
}
