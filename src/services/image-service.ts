/**
 * Service for managing custom image-based shapes
 */
export interface CustomImage {
  id: string;
  name: string;
  dataUrl: string; // Base64-encoded image data
  width: number;
  height: number;
  created: number;
}

export class ImageService {
  private static readonly STORAGE_KEY = 'railway-drawer-custom-images';
  private static instance: ImageService;
  private images: Map<string, CustomImage> = new Map();

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  /**
   * Upload and register a new image
   */
  uploadImage(file: File, name?: string): Promise<CustomImage> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const dataUrl = event.target?.result as string;

          // Get image dimensions
          const img = new Image();
          img.onload = () => {
            const customImage: CustomImage = {
              id: `img-${Date.now()}`,
              name: name || file.name,
              dataUrl,
              width: img.width,
              height: img.height,
              created: Date.now(),
            };

            this.images.set(customImage.id, customImage);
            this.saveToStorage();
            resolve(customImage);
          };
          img.onerror = () => {
            reject(new Error('Failed to load image'));
          };
          img.src = dataUrl;
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Get all custom images
   */
  getImages(): CustomImage[] {
    return Array.from(this.images.values());
  }

  /**
   * Get a specific image by ID
   */
  getImage(id: string): CustomImage | undefined {
    return this.images.get(id);
  }

  /**
   * Delete a custom image
   */
  deleteImage(id: string): boolean {
    const deleted = this.images.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Update image metadata
   */
  updateImage(id: string, updates: Partial<Omit<CustomImage, 'id' | 'dataUrl'>>): boolean {
    const image = this.images.get(id);
    if (!image) return false;

    Object.assign(image, updates);
    this.saveToStorage();
    return true;
  }

  /**
   * Clear all custom images
   */
  clearAll(): void {
    this.images.clear();
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.images.values());
      localStorage.setItem(ImageService.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[ImageService] Failed to save to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(ImageService.STORAGE_KEY);
      if (data) {
        const images = JSON.parse(data) as CustomImage[];
        images.forEach((img) => {
          this.images.set(img.id, img);
        });
        console.log(`[ImageService] Loaded ${images.length} custom images from storage`);
      }
    } catch (error) {
      console.error('[ImageService] Failed to load from storage:', error);
    }
  }
}
