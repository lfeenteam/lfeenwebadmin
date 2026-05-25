import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';

interface ImageCard {
  id: number;
  url: string;
  name: string;
  category: string;
  status: 'accepted' | 'rejected' | 'pending';
  rejectionReason?: string;
  suggestedSolution?: string;
}

@Component({
  selector: 'app-review-image',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule],
  templateUrl: './review-image.component.html',
  styleUrl: './review-image.component.scss'
})
export class ReviewImageComponent {
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<void>();

  mainImage: ImageCard = {
    id: 1,
    url: 'assets/images/products/review_image1.jpg',
    name: 'الواجهة الرئيسية',
    category: 'خارجي - نهاري',
    status: 'pending'
  };

  exteriorImages: ImageCard[] = [
    { id: 2, url: 'assets/images/products/review_image.png', name: 'منطقة المسبح', category: 'مرافق عامة', status: 'pending' },
    { id: 3, url: 'assets/images/products/review_image.png', name: 'مدخل المواقف', category: 'خارجي - عام', status: 'rejected', rejectionReason: 'سبب الرفض...', suggestedSolution: 'الحل المقترح للمضيف...' },
    { id: 4, url: 'assets/images/products/review_image.png', name: 'الواجهة الرئيسية', category: 'خارجي - نهاري', status: 'accepted' },
  ];

  interiorImages: ImageCard[] = [
    { id: 5, url: 'assets/images/products/review_image.png', name: 'منطقة المسبح', category: 'مرافق عامة', status: 'pending' },
    { id: 6, url: 'assets/images/products/review_image.png', name: 'مدخل المواقف', category: 'داخلي - عام', status: 'rejected', rejectionReason: 'سبب الرفض...', suggestedSolution: 'الحل المقترح للمضيف...' },
    { id: 7, url: 'assets/images/products/review_image.png', name: 'الواجهة الرئيسية', category: 'داخلي - نهاري', status: 'accepted' },
  ];

  get hasRejections(): boolean {
    return this.mainImage.status === 'rejected' ||
           this.exteriorImages.some(img => img.status === 'rejected') ||
           this.interiorImages.some(img => img.status === 'rejected');
  }

  get rejectedSections() {
    const rejected = [];
    if (this.exteriorImages.some(img => img.status === 'rejected')) {
      rejected.push({ title: 'صور الواجهة والمداخل', reason: 'يوجد صورة مشوشة وتحتاج لاعادة تصوير الواجهة بطريقة اكثر وضوح للسكان، بل نرجو توخي نشاط مستقبلاً' });
    }
    if (this.interiorImages.some(img => img.status === 'rejected')) {
      rejected.push({ title: 'صور المرافق الداخلية', reason: 'صور رديئة مع زوايا تصوير غير واضحة والاضاءة تظهر بشكل واضح مما قلل من جودة العقار في القاعة' });
    }
    return rejected;
  }

  setStatus(image: ImageCard, status: 'accepted' | 'rejected') {
    image.status = status;
  }

  goBack() {
    this.back.emit();
  }
}
