import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconModule } from 'src/app/icon/icon.module';
import { MaterialModule } from 'src/app/material.module';

interface socialcards {
  id: number;
  imgSrc: string;
  username: string;
  post: string;
}
@Component({
  selector: 'app-friends',
  imports: [MaterialModule,IconModule,CommonModule, FormsModule],
  templateUrl: './friends.component.html',
})
export class FriendsComponent implements OnInit{

  socialcards: socialcards[] = [
    { id: 1, imgSrc: 'assets/images/profile/user-1.jpg', username: 'Andrew Grant', post: 'Technology Director' },
    { id: 2, imgSrc: 'assets/images/profile/user-2.jpg', username: 'Leo Pratt', post: 'Senior Tech Lead' },
    { id: 3, imgSrc: 'assets/images/profile/user-3.jpg', username: 'Charles Nunez', post: 'Digital Solutions Head' },
    { id: 4, imgSrc: 'assets/images/profile/user-4.jpg', username: 'Andy G. Emerson', post: 'Tech Infrastructure Lead' },
    { id: 5, imgSrc: 'assets/images/profile/user-5.jpg', username: 'Leonard Pratt', post: 'Chief Systems Architect' },
    { id: 6, imgSrc: 'assets/images/profile/user-6.jpg', username: 'C. A. Nunez', post: 'Innovation Manager' },
    { id: 7, imgSrc: 'assets/images/profile/user-7.jpg', username: 'Andrew G. Riley', post: 'Technical Strategy Head' },
    { id: 8, imgSrc: 'assets/images/profile/user-8.jpg', username: 'L. P. Walters', post: 'Principal Engineer' },
    { id: 9, imgSrc: 'assets/images/profile/user-9.jpg', username: 'Charlie Nunez', post: 'Technology Advisor' },
    { id: 10, imgSrc: 'assets/images/profile/user-10.jpg', username: 'A. Granton', post: 'Digital Transformation Lead' },
    { id: 12, imgSrc: 'assets/images/profile/user-2.jpg', username: 'Leo P. Maxwell', post: 'Platform Engineering Lead' },
    { id: 13, imgSrc: 'assets/images/profile/user-3.jpg', username: 'C. Nunez Jr.', post: 'Director of Tech Ops' },
    { id: 14, imgSrc: 'assets/images/profile/user-1.jpg', username: 'Grant Andrews', post: 'Tech Division Manager' },
    { id: 15, imgSrc: 'assets/images/profile/user-2.jpg', username: 'Leo P.', post: 'Solutions Architect' },
    { id: 16, imgSrc: 'assets/images/profile/user-3.jpg', username: 'Charles N.', post: 'Cloud Strategy Lead' }
  ];
  
  ngOnInit(): void {
    this.applyFilter();
  }
  searchText: string = '';
  filteredCount: number = 0;
filteredSocialcards: socialcards[] = [];
applyFilter() {
  const searchLower = this.searchText.toLowerCase();
  this.filteredSocialcards = this.socialcards.filter(card =>
    card.username.toLowerCase().includes(searchLower) ||
    card.post.toLowerCase().includes(searchLower)
  );
  this.filteredCount = this.filteredSocialcards.length;   // ✅ update count here
}
}
