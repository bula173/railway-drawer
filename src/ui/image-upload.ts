import { Graph } from '@maxgraph/core';
import { ImageService } from '../services/image-service';

export class ImageUploadController {
  private imageService: ImageService;
  private uploadButton: HTMLElement | null;
  private modal: HTMLDivElement | null = null;

  constructor(_graph: Graph) {
    this.imageService = ImageService.getInstance();
    this.uploadButton = document.getElementById('btn-upload-image');

    if (this.uploadButton) {
      this.uploadButton.addEventListener('click', () => this.openUploadDialog());
    }
  }

  private openUploadDialog(): void {
    if (this.modal) {
      (this.modal as HTMLElement).style.display = 'flex';
      return;
    }

    this.createUploadModal();
    if (this.modal) {
      (this.modal as HTMLElement).style.display = 'flex';
    }
  }

  private createUploadModal(): void {
    this.modal = document.createElement('div') as HTMLDivElement;
    this.modal.id = 'image-upload-modal';
    this.modal.style.cssText = `
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--rd-overlay);
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const modalContent = document.createElement('div') as HTMLElement;
    (modalContent as HTMLElement).style.cssText = `
      background: var(--rd-surface);
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 2px 12px var(--rd-shadow);
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Upload Custom Shape Image';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px; color: var(--rd-text);';
    modalContent.appendChild(title);

    // Upload area
    const uploadArea = document.createElement('div');
    uploadArea.style.cssText = `
      border: 2px dashed var(--rd-border-strong);
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      cursor: pointer;
      background: var(--rd-surface-2);
      margin-bottom: 16px;
      transition: background 0.2s;
    `;
    uploadArea.textContent = '📁 Drop image here or click to select';
    uploadArea.style.cursor = 'pointer';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.background = 'var(--rd-hover)';
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.background = 'var(--rd-surface-2)';
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.background = 'var(--rd-surface-2)';
      const files = e.dataTransfer?.files;
      if (files?.[0]) {
        this.handleFileSelect(files[0], modalContent, uploadArea);
      }
    });

    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files?.[0]) {
        this.handleFileSelect(files[0], modalContent, uploadArea);
      }
    });

    modalContent.appendChild(uploadArea);

    // Image preview
    const previewContainer = document.createElement('div');
    previewContainer.id = 'image-preview-container';
    previewContainer.style.cssText = `
      margin-bottom: 16px;
      display: none;
    `;
    modalContent.appendChild(previewContainer);

    // Name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Shape Name:';
    nameLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 600; color: var(--rd-text);';
    modalContent.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'image-name-input';
    nameInput.placeholder = 'e.g., "Custom Signal" or "Station Building"';
    nameInput.style.cssText = `
      width: 100%;
      padding: 8px;
      border: 1px solid var(--rd-border-strong);
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
      margin-bottom: 16px;
    `;
    modalContent.appendChild(nameInput);

    // Existing images
    const existingImagesLabel = document.createElement('label');
    existingImagesLabel.textContent = 'Your Custom Shapes:';
    existingImagesLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 600; color: var(--rd-text);';
    modalContent.appendChild(existingImagesLabel);

    const imagesList = document.createElement('div');
    imagesList.id = 'custom-images-list';
    imagesList.style.cssText = `
      border: 1px solid var(--rd-border);
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 16px;
    `;
    this.updateImagesList(imagesList);
    modalContent.appendChild(imagesList);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    `;

    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = 'Upload & Create Shape';
    uploadBtn.style.cssText = `
      padding: 10px 16px;
      background: var(--rd-accent);
      color: var(--rd-accent-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    `;
    uploadBtn.addEventListener('click', () => {
      const file = fileInput.files?.[0];
      if (file) {
        const name = (nameInput.value || file.name).replace(/\.[^/.]+$/, '');
        this.uploadAndRegisterImage(file, name, modalContent);
      }
    });
    buttonContainer.appendChild(uploadBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      padding: 10px 16px;
      background: var(--rd-surface-3);
      color: var(--rd-text);
      border: 1px solid var(--rd-border-strong);
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    `;
    closeBtn.addEventListener('click', () => {
      if (this.modal) {
        (this.modal as HTMLElement).style.display = 'none';
      }
    });
    buttonContainer.appendChild(closeBtn);

    modalContent.appendChild(buttonContainer);
    this.modal!.appendChild(modalContent);
    document.body.appendChild(this.modal);

    // Close on background click
    this.modal!.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        (this.modal as HTMLElement).style.display = 'none';
      }
    });
  }

  private handleFileSelect(file: File, modalContent: HTMLElement, uploadArea: HTMLElement): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewContainer = modalContent.querySelector('#image-preview-container') as HTMLElement;
      if (previewContainer) {
        previewContainer.style.display = 'block';
        // Build via DOM APIs: file.name is user-controlled and must not be parsed as HTML
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'border: 1px solid var(--rd-border-strong); border-radius: 4px; padding: 8px; background: var(--rd-surface-2);';
        const img = document.createElement('img');
        const result = e.target?.result;
        if (typeof result === 'string') img.src = result;
        img.style.cssText = 'max-width: 100%; max-height: 200px; border-radius: 4px;';
        const caption = document.createElement('p');
        caption.style.cssText = 'margin: 8px 0 0 0; font-size: 12px; color: var(--rd-text-muted);';
        caption.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        wrapper.appendChild(img);
        wrapper.appendChild(caption);
        previewContainer.replaceChildren(wrapper);
      }
      uploadArea.textContent = '✓ Image selected: ' + file.name;
    };
    reader.readAsDataURL(file);
  }

  private async uploadAndRegisterImage(file: File, name: string, modalContent: HTMLElement): Promise<void> {
    try {
      const uploadBtn = modalContent.querySelector('button') as HTMLButtonElement;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';

      const customImage = await this.imageService.uploadImage(file, name);

      uploadBtn.textContent = '✓ Upload & Create Shape';
      uploadBtn.style.background = 'var(--rd-success-solid)';

      // Update list
      const imagesList = modalContent.querySelector('#custom-images-list') as HTMLElement;
      this.updateImagesList(imagesList);

      setTimeout(() => {
        (uploadBtn as HTMLButtonElement).disabled = false;
        uploadBtn.textContent = 'Upload & Create Shape';
        (uploadBtn as HTMLElement).style.background = 'var(--rd-accent)';

        // Reset form
        const nameInput = modalContent.querySelector('#image-name-input') as HTMLInputElement;
        const previewContainer = modalContent.querySelector('#image-preview-container') as HTMLElement;
        nameInput.value = '';
        previewContainer.style.display = 'none';

        // Show success message
        console.log(`[ImageUpload] Successfully uploaded: ${customImage.name}`);
      }, 1500);
    } catch (error) {
      console.error('[ImageUpload] Upload failed:', error);
      alert('Failed to upload image. Please try again.');
      const uploadBtn = modalContent.querySelector('button') as HTMLButtonElement;
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload & Create Shape';
    }
  }

  private updateImagesList(imagesList: HTMLElement): void {
    const images = this.imageService.getImages();

    if (images.length === 0) {
      imagesList.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--rd-text-subtle);">No custom shapes uploaded yet</p>';
      return;
    }

    imagesList.innerHTML = '';
    images.forEach((img) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 12px;
        border-bottom: 1px solid var(--rd-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
      `;

      const info = document.createElement('div');
      info.style.cssText = 'flex: 1;';
      // img.name is user-controlled (persisted in localStorage): use textContent, not innerHTML
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-weight: 600; font-size: 13px; color: var(--rd-text);';
      nameEl.textContent = img.name;
      const sizeEl = document.createElement('div');
      sizeEl.style.cssText = 'font-size: 11px; color: var(--rd-text-subtle);';
      sizeEl.textContent = `${img.width}×${img.height}px`;
      info.appendChild(nameEl);
      info.appendChild(sizeEl);
      item.appendChild(info);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        color: var(--rd-danger);
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
      `;
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete "${img.name}"?`)) {
          this.imageService.deleteImage(img.id);
          this.updateImagesList(imagesList);
        }
      });
      item.appendChild(deleteBtn);

      imagesList.appendChild(item);
    });
  }

  destroy(): void {
    if (this.modal?.parentElement) {
      this.modal.parentElement.removeChild(this.modal);
    }
    this.modal = null;
  }
}
