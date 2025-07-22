// إدارة الإعلانات - JavaScript
document.addEventListener("DOMContentLoaded", function() {
  // المتغيرات العامة
  const addStoryBtn = document.getElementById('addStory');
  const addStoryModal = document.getElementById('addStoryModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const editAdModal = document.getElementById('editAdModal');
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const storySlider = document.getElementById('storySlider');
  const storyView = document.getElementById('storyView');
  const storyImage = document.getElementById('storyImage');
  const storyText = document.getElementById('storyText');
  const adText = document.getElementById('adText');
  const closeBtn = document.getElementById('closeBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressContainer = document.getElementById('progressContainer');
  const adActionsExpanded = document.getElementById('adActionsExpanded');
  const editAdBtnExpanded = document.getElementById('editAdBtnExpanded');
  const deleteAdBtnExpanded = document.getElementById('deleteAdBtnExpanded');
  const addAdForm = document.getElementById('addAdForm');
  const editAdForm = document.getElementById('editAdForm');

  let currentStoryIndex = 0;
  let stories = Array.from(document.querySelectorAll('.story-item:not(.add-story)'));
  let intervalId;
  let currentAdId = null;

  // فتح مودال إضافة إعلان
  if (addStoryBtn) {
    addStoryBtn.addEventListener('click', () => {
      addStoryModal.classList.add('show');
    });
  }

  // إغلاق مودال إضافة إعلان
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      addStoryModal.classList.remove('show');
      if (addAdForm) addAdForm.reset();
    });
  }

  // إغلاق مودال تعديل إعلان
  if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener('click', () => {
      editAdModal.classList.remove('show');
      if (editAdForm) editAdForm.reset();
    });
  }

  // النقر على الإعلانات لعرضها
  if (storySlider) {
    storySlider.addEventListener('click', (e) => {
      const storyItem = e.target.closest('.story-item:not(.add-story)');
      if (storyItem && !e.target.closest('.ad-actions')) {
        currentStoryIndex = stories.indexOf(storyItem);
        showStory();
      }
    });
  }

  // إغلاق عرض الإعلان المكبر
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideStory();
    });
  }

  // التنقل بين الإعلانات
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentStoryIndex = Math.max(0, currentStoryIndex - 1);
      showStory();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentStoryIndex = Math.min(stories.length - 1, currentStoryIndex + 1);
      showStory();
    });
  }

  // عرض الإعلان
  function showStory() {
    if (stories.length === 0) return;
    const story = stories[currentStoryIndex];
    currentAdId = story.dataset.id;
    const adUserId = story.dataset.userId;
    
    storyImage.src = story.dataset.image || '';
    storyText.textContent = story.dataset.title || '';
    adText.textContent = story.dataset.description || '';
    storyView.classList.add('show');
    
    // إظهار أيقونات التعديل والحذف إذا كان المستخدم هو صاحب الإعلان
    if (currentUserId && adUserId === currentUserId) {
      adActionsExpanded.style.display = 'flex';
    } else {
      adActionsExpanded.style.display = 'none';
    }
    
    updateProgressBars();
    startProgress();
  }

  // إخفاء عرض الإعلان
  function hideStory() {
    storyView.classList.remove('show');
    clearInterval(intervalId);
    progressContainer.innerHTML = '';
    adActionsExpanded.style.display = 'none';
    currentAdId = null;
  }

  // تحديث شريط التقدم
  function updateProgressBars() {
    progressContainer.innerHTML = '';
    stories.forEach((_, index) => {
      const bar = document.createElement('div');
      bar.classList.add('progress-bar');
      const progress = document.createElement('div');
      progress.classList.add('progress');
      if (index === currentStoryIndex) {
        progress.style.width = '0%';
      } else if (index < currentStoryIndex) {
        progress.style.width = '100%';
      }
      bar.appendChild(progress);
      progressContainer.appendChild(bar);
    });
  }

  // بدء شريط التقدم
  function startProgress() {
    clearInterval(intervalId);
    const progressBars = document.querySelectorAll('.progress-bar .progress');
    const currentProgress = progressBars[currentStoryIndex];
    let width = 0;
    intervalId = setInterval(() => {
      width += 1;
      currentProgress.style.width = `${width}%`;
      if (width >= 100) {
        clearInterval(intervalId);
        currentStoryIndex = Math.min(stories.length - 1, currentStoryIndex + 1);
        if (currentStoryIndex < stories.length) {
          showStory();
        } else {
          hideStory();
        }
      }
    }, 50);
  }

  // معالجة أزرار التعديل والحذف في الإعلانات الصغيرة
  document.addEventListener('click', async function(e) {
    if (e.target.closest('.edit-ad-btn')) {
      e.stopPropagation();
      const adId = e.target.closest('.edit-ad-btn').dataset.adId;
      await openEditAdModal(adId);
    }
    
    if (e.target.closest('.delete-ad-btn')) {
      e.stopPropagation();
      const adId = e.target.closest('.delete-ad-btn').dataset.adId;
      await deleteAd(adId);
    }
  });

  // معالجة أزرار التعديل والحذف في العرض المكبر
  if (editAdBtnExpanded) {
    editAdBtnExpanded.addEventListener('click', async () => {
      if (currentAdId) {
        await openEditAdModal(currentAdId);
      }
    });
  }

  if (deleteAdBtnExpanded) {
    deleteAdBtnExpanded.addEventListener('click', async () => {
      if (currentAdId) {
        await deleteAd(currentAdId);
      }
    });
  }

  // فتح مودال تعديل الإعلان
  async function openEditAdModal(adId) {
    try {
      const response = await fetch(`/forum/ad/${adId}`);
      const data = await response.json();
      
      if (data.success) {
        const ad = data.ad;
        document.getElementById('editAdId').value = ad.id;
        document.getElementById('editTitle').value = ad.title;
        document.getElementById('editDescription').value = ad.description;
        
        // عرض الصورة الحالية
        const currentImage = document.getElementById('currentAdImage');
        const imagePreview = document.getElementById('currentImagePreview');
        if (ad.image) {
          currentImage.src = ad.image;
          imagePreview.style.display = 'block';
        } else {
          imagePreview.style.display = 'none';
        }
        
        editAdModal.classList.add('show');
      } else {
        showAlert('error', 'خطأ', 'لم يتم العثور على الإعلان');
      }
    } catch (error) {
      showAlert('error', 'خطأ', 'حدث خطأ في تحميل بيانات الإعلان');
    }
  }

  // حذف الإعلان
  async function deleteAd(adId) {
    const result = await Swal.fire({
      title: 'تأكيد الحذف',
      text: 'هل أنت متأكد من حذف هذا الإعلان؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/forum/ad/${adId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          showAlert('success', 'تم الحذف', 'تم حذف الإعلان بنجاح');
          
          // إعادة تحميل الصفحة لتحديث الإعلانات
          setTimeout(() => {
            location.reload();
          }, 2000);
        } else {
          showAlert('error', 'خطأ', data.message || 'فشل في حذف الإعلان');
        }
      } catch (error) {
        showAlert('error', 'خطأ', 'حدث خطأ في حذف الإعلان');
      }
    }
  }

  // إضافة إعلان جديد
  if (addAdForm) {
    addAdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(addAdForm);
      try {
        const response = await fetch('/forum/ad', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        const result = await response.json();
        if (result.success) {
          showAlert('success', 'تم الإضافة', 'تم إضافة الإعلان بنجاح');
          addStoryModal.classList.remove('show');
          setTimeout(() => {
            location.reload();
          }, 2000);
        } else {
          showAlert('error', 'خطأ', result.message);
        }
      } catch (error) {
        showAlert('error', 'خطأ', 'حدث خطأ غير متوقع!');
      }
    });
  }

  // تعديل إعلان
  if (editAdForm) {
    editAdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(editAdForm);
      const adId = document.getElementById('editAdId').value;
      
      try {
        const response = await fetch(`/forum/ad/${adId}`, {
          method: 'PUT',
          body: formData,
          credentials: 'include'
        });
        const result = await response.json();
        if (result.success) {
          showAlert('success', 'تم التحديث', 'تم تحديث الإعلان بنجاح');
          editAdModal.classList.remove('show');
          setTimeout(() => {
            location.reload();
          }, 2000);
        } else {
          showAlert('error', 'خطأ', result.message);
        }
      } catch (error) {
        showAlert('error', 'خطأ', 'حدث خطأ غير متوقع!');
      }
    });
  }

  // دالة عرض التنبيهات
  function showAlert(type, title, text) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: type,
        title: title,
        text: text,
        timer: type === 'success' ? 2000 : undefined,
        showConfirmButton: type !== 'success'
      });
    } else {
      alert(`${title}: ${text}`);
    }
  }

  // إغلاق المودال عند النقر خارجه
  window.addEventListener('click', function(e) {
    if (e.target === addStoryModal) {
      addStoryModal.classList.remove('show');
      if (addAdForm) addAdForm.reset();
    }
    if (e.target === editAdModal) {
      editAdModal.classList.remove('show');
      if (editAdForm) editAdForm.reset();
    }
  });

  // إغلاق عرض الإعلان عند الضغط على Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (storyView.classList.contains('show')) {
        hideStory();
      }
      if (addStoryModal.classList.contains('show')) {
        addStoryModal.classList.remove('show');
        if (addAdForm) addAdForm.reset();
      }
      if (editAdModal.classList.contains('show')) {
        editAdModal.classList.remove('show');
        if (editAdForm) editAdForm.reset();
      }
    }
  });

  // تحديث قائمة الإعلانات عند إضافة أو تعديل إعلان
  function updateStoriesList() {
    stories = Array.from(document.querySelectorAll('.story-item:not(.add-story)'));
  }

  // استدعاء تحديث القائمة عند تحميل الصفحة
  updateStoriesList();
});

