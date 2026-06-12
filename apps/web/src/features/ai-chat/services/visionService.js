// تشخیص مواد غذایی از تصویر (نسخه سمت کلاینت)
// در نسخه واقعی این با یک API مانند Google Vision یا Clarifai جایگزین می‌شود

const KNOWN_INGREDIENTS = [
  'گوجه', 'پیاز', 'سیر', 'مرغ', 'گوشت', 'برنج', 'تخم‌مرغ',
  'سیب‌زمینی', 'هویج', 'فلفل', 'قارچ', 'کدو', 'بادمجان',
  'لیمو', 'پرتقال', 'سیب', 'موز', 'ماست', 'شیر', 'پنیر',
  'سبزی', 'کره', 'روغن', 'رب', 'زعفران', 'نمک', 'عدس',
  'لوبیا', 'نخود', 'ماهی', 'میگو', 'گردو', 'بادام',
];

export const analyzeImage = async (_imageFile) => {
  // شبیه‌سازی تشخیص (در نسخه واقعی: ارسال به API)
  return new Promise((resolve) => {
    setTimeout(() => {
      const detectedCount = 3 + Math.floor(Math.random() * 7);
      const shuffled = [...KNOWN_INGREDIENTS].sort(() => 0.5 - Math.random());
      const detected = shuffled.slice(0, detectedCount);
      
      resolve({
        success: true,
        ingredients: detected,
        confidence: 0.7 + Math.random() * 0.25,
        method: 'simulated_vision',
      });
    }, 1500 + Math.random() * 2000);
  });
};

export const isImageFile = (file) => {
  return file?.type?.startsWith('image/');
};
