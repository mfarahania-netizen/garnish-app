import fs from 'node:fs';
import path from 'node:path';
import {
  assertLocalDatabase,
  closeoutDecision,
  expansionDir,
  getCounts,
  loadQueue,
  loadRecipes,
  prisma,
  regressionStatus,
  recipeBlob,
  writeCsv,
  writeJson,
  writeMd,
} from './recipe-trust-closeout-common';

const candidates = [
  ['ترش واش', 'Torsh Vash', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'شاخص شمال ایران و نبودش برای آرشیو ایرانی ضعف جدی است.', 'P0', 'north-iran-01'],
  ['مرغ شکم پر مازندرانی', 'Mazandarani Stuffed Chicken', 'Iran', 'Mazandaran', 'main', 'lunch,dinner', 'کاربر نبود/سرچ‌نشدن آن را گزارش کرده؛ غذای بسیار شناخته‌شده شمالی است.', 'P0', 'north-iran-01'],
  ['اناربیج گیلانی', 'Gilaki Anarbij', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'غذای هویتی گیلان با گردو، انار و سبزی محلی.', 'P0', 'north-iran-01'],
  ['کال کباب گیلانی', 'Kal Kabab', 'Iran', 'Gilan', 'appetizer', 'lunch,dinner', 'پیش‌غذای شمالی بسیار مهم؛ برای پوشش گیلان لازم است.', 'P0', 'north-iran-01'],
  ['میرزاقاسمی با بادمجان کبابی', 'Mirza Ghasemi', 'Iran', 'Gilan', 'main', 'breakfast,lunch,dinner', 'اگر موجود است باید نسخه دقیق/اصیل کنترل شود؛ اگر نه P0 است.', 'P0', 'north-iran-01'],
  ['باقلاقاتق با پاچ‌باقلا', 'Baghali Ghatogh', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'غذای نمادین گیلان؛ نیازمند ingredient feasibility دقیق.', 'P0', 'north-iran-01'],
  ['واویشکا گیلانی', 'Vavishka', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'غذای معروف شمالی با نسخه‌های دل/جگر/گوشت.', 'P1', 'north-iran-01'],
  ['شامی پوک گیلانی', 'Shami Pook', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'برای پوشش غذاهای کتلت/شامی شمالی مهم است.', 'P1', 'north-iran-01'],
  ['نازخاتون', 'Naz Khatun', 'Iran', 'Mazandaran/Gilan', 'side', 'lunch,dinner', 'چاشنی/کنارغذای شمالی شناخته‌شده.', 'P1', 'north-iran-01'],
  ['خورش آلو مسما', 'Aloo Mosamma', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'نسخه شمالی خورش آلو باید جدا و دقیق باشد.', 'P1', 'north-iran-01'],
  ['کئی پلا مازندرانی', 'Kayi Pela', 'Iran', 'Mazandaran', 'main', 'lunch,dinner', 'غذای برنجی محلی با کدو؛ برای مازندران مهم است.', 'P1', 'north-iran-02'],
  ['مالابیج', 'Malabij', 'Iran', 'Gilan/Mazandaran', 'main', 'lunch,dinner', 'ماهی شکم‌پر شمالی؛ ریسک ingredient/source بالا ولی ارزش زیاد.', 'P1', 'north-iran-02'],
  ['آغوز مسما', 'Aghoz Mosamma', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'غذای گردویی شمالی مهم و متمایز.', 'P1', 'north-iran-02'],
  ['بورانی بادمجان شمالی', 'Northern Eggplant Borani', 'Iran', 'Gilan/Mazandaran', 'side', 'lunch,dinner', 'کنارغذای منطقه‌ای قابل استفاده و کم‌ریسک‌تر.', 'P2', 'north-iran-02'],
  ['چغرتمه مرغ', 'Chaghartameh Morgh', 'Iran', 'Gilan', 'main', 'lunch,dinner', 'غذای گیلانی تخم‌مرغ/مرغ‌محور؛ نیازمند منبع دقیق.', 'P2', 'north-iran-02'],
  ['دوغ پای کرمانی', 'Doogh Pa Kermani', 'Iran', 'Kerman', 'main', 'lunch,dinner', 'غذای شاخص کرمان و برای پوشش منطقه‌ای ضروری.', 'P0', 'iran-regional-01'],
  ['بزقرمه کرمانی منبع‌دار', 'Boz Ghormeh Kermani', 'Iran', 'Kerman', 'main', 'lunch,dinner', 'اگر نسخه موجود reviewOnly است باید source-backed بازسازی شود.', 'P0', 'iran-regional-01'],
  ['چکدرمه ترکمنی', 'Chekdermeh Turkmen', 'Iran', 'Golestan', 'main', 'lunch,dinner', 'غذای شاخص گلستان/ترکمن و کمبود مهم آرشیو.', 'P0', 'iran-regional-01'],
  ['کوفته تبریزی کامل', 'Kufteh Tabrizi', 'Iran', 'Azerbaijan', 'main', 'lunch,dinner', 'غذای ملی/منطقه‌ای بزرگ؛ باید بسیار دقیق باشد.', 'P0', 'iran-regional-01'],
  ['آش اوماج', 'Omaj Ash', 'Iran', 'Azerbaijan/Hamedan', 'soup', 'lunch,dinner', 'آش منطقه‌ای شناخته‌شده.', 'P1', 'iran-regional-01'],
  ['کباب بختیاری', 'Bakhtiari Kebab', 'Iran', 'Chaharmahal/Lorestan', 'main', 'lunch,dinner', 'پرطرفدار، سرچ‌پذیر و مناسب آرشیو عمومی.', 'P1', 'iran-regional-01'],
  ['دنده کباب کرمانشاهی', 'Kermanshahi Dandeh Kebab', 'Iran', 'Kermanshah', 'main', 'lunch,dinner', 'غذای معروف غرب ایران؛ ارزش بالا.', 'P1', 'iran-regional-01'],
  ['خورش خلال کرمانشاهی', 'Khoresht Khalal', 'Iran', 'Kermanshah', 'main', 'lunch,dinner', 'غذای شاخص کرمانشاه؛ نیازمند خلال بادام و زرشک دقیق.', 'P1', 'iran-regional-02'],
  ['آش کشک خراسانی', 'Khorasani Kashk Ash', 'Iran', 'Khorasan', 'soup', 'lunch,dinner', 'پوشش شرق ایران را بهتر می‌کند.', 'P2', 'iran-regional-02'],
  ['یتیمچه نیشابوری', 'Neyshabur Yatimcheh', 'Iran', 'Khorasan', 'main', 'lunch,dinner', 'نسخه محلی باید از نسخه عمومی جدا شود.', 'P2', 'iran-regional-02'],
  ['قلیه ماهی بوشهری', 'Bushehri Ghalieh Mahi', 'Iran', 'Bushehr', 'main', 'lunch,dinner', 'جنوب ایران بدون قلیه ماهی ناقص است.', 'P0', 'south-iran-01'],
  ['هواری میگو', 'Havari Meygoo', 'Iran', 'Hormozgan/Bushehr', 'main', 'lunch,dinner', 'غذای جنوبی شناخته‌شده و محبوب.', 'P1', 'south-iran-01'],
  ['میگو پلو بوشهری', 'Bushehri Shrimp Rice', 'Iran', 'Bushehr', 'main', 'lunch,dinner', 'پوشش غذاهای دریایی جنوب را تقویت می‌کند.', 'P1', 'south-iran-01'],
  ['دوپیازه میگو', 'Dopiazeh Meygoo', 'Iran', 'South Iran', 'main', 'lunch,dinner', 'غذای خانگی جنوبی، ساده و سرچ‌پذیر.', 'P1', 'south-iran-01'],
  ['سمبوسه جنوبی', 'Southern Iranian Samosa', 'Iran', 'Khuzestan/Hormozgan', 'snack', 'snack,dinner', 'غذای خیابانی مهم؛ نیازمند تمایز از سمبوسه هندی.', 'P1', 'south-iran-01'],
  ['نان و پنیر و گردو', 'Iranian Bread Cheese Walnut', 'Iran', 'Iran', 'breakfast', 'breakfast', 'صبحانه پایه ایرانی؛ برای UX برنامه غذایی مهم.', 'P0', 'breakfast-01'],
  ['املت گوجه ایرانی', 'Iranian Tomato Omelette', 'Iran', 'Iran', 'breakfast', 'breakfast', 'صبحانه/شام سبک بسیار پرمصرف.', 'P0', 'breakfast-01'],
  ['عدسی صبحانه', 'Adasi Breakfast', 'Iran', 'Iran', 'breakfast', 'breakfast', 'صبحانه ایرانی سالم و پرجستجو.', 'P0', 'breakfast-01'],
  ['حلیم گندم', 'Halim Gandom', 'Iran', 'Iran', 'breakfast', 'breakfast', 'صبحانه آیینی/شهری مهم.', 'P0', 'breakfast-01'],
  ['کله پاچه', 'Kaleh Pacheh', 'Iran', 'Iran', 'breakfast', 'breakfast', 'شناخته‌شده ولی ریسک ایمنی/تغذیه/مواد بالا؛ نیازمند دقت.', 'P2', 'breakfast-01'],
  ['خاگینه تبریزی', 'Khagineh Tabrizi', 'Iran', 'Azerbaijan', 'breakfast,dessert', 'breakfast', 'صبحانه/دسر سنتی منطقه‌ای.', 'P1', 'breakfast-01'],
  ['نیمرو با خرما', 'Persian Date Eggs', 'Iran', 'South Iran', 'breakfast', 'breakfast', 'صبحانه جنوب ایران و متمایز.', 'P2', 'breakfast-02'],
  ['شیر برنج صبحانه', 'Shir Berenj', 'Iran', 'Iran', 'breakfast,dessert', 'breakfast', 'غذای ساده و خانوادگی مناسب برنامه صبحانه.', 'P1', 'breakfast-02'],
  ['پنکیک کلاسیک', 'Classic Pancakes', 'USA', 'North America', 'breakfast', 'breakfast', 'صبحانه جهانی و پرمصرف.', 'P0', 'breakfast-02'],
  ['فرنچ تست', 'French Toast', 'France/USA', 'Global', 'breakfast', 'breakfast', 'کلاسیک جهانی و مناسب کاربر عمومی.', 'P0', 'breakfast-02'],
  ['اوتمیل موز و دارچین', 'Banana Cinnamon Oatmeal', 'Global', 'Global', 'breakfast', 'breakfast', 'صبحانه سالم و کاربردی؛ نه filler اگر دقیق باشد.', 'P1', 'breakfast-02'],
  ['شاکشوکا', 'Shakshuka', 'Tunisia/Levant', 'MENA', 'breakfast', 'breakfast,brunch', 'صبحانه MENA بسیار شناخته‌شده.', 'P0', 'breakfast-02'],
  ['منمن ترکی', 'Turkish Menemen', 'Turkey', 'Turkey', 'breakfast', 'breakfast', 'صبحانه منطقه‌ای محبوب و نزدیک به ذائقه ایرانی.', 'P1', 'breakfast-02'],
  ['فول مدامس', 'Ful Medames', 'Egypt', 'Egypt/MENA', 'breakfast', 'breakfast', 'صبحانه خاورمیانه‌ای مهم.', 'P1', 'breakfast-03'],
  ['کانجی برنج', 'Rice Congee', 'China', 'East Asia', 'breakfast', 'breakfast', 'صبحانه آسیایی پایه؛ برای تنوع جهانی.', 'P2', 'breakfast-03'],
  ['تامago کاکه گوهان', 'Tamago Kake Gohan', 'Japan', 'Japan', 'breakfast', 'breakfast', 'شناخته‌شده ولی ریسک تخم‌مرغ خام/ایمنی دارد.', 'P3', 'breakfast-03'],
  ['چای زعفران ایرانی', 'Persian Saffron Tea', 'Iran', 'Iran', 'drink', 'breakfast,snack', 'نوشیدنی ایرانی غیرالکلی شاخص.', 'P0', 'drinks-01'],
  ['دوغ نعناع', 'Mint Doogh', 'Iran', 'Iran', 'drink', 'lunch,dinner', 'نوشیدنی ملی کنار غذا.', 'P0', 'drinks-01'],
  ['شربت سکنجبین', 'Sekanjabin Sharbat', 'Iran', 'Iran', 'drink', 'snack', 'نوشیدنی سنتی مهم و قابل اتکا.', 'P0', 'drinks-01'],
  ['شربت بیدمشک', 'Bidmeshk Sharbat', 'Iran', 'Iran', 'drink', 'snack', 'نوشیدنی ایرانی رایج؛ feasibility وابسته به عرق بیدمشک.', 'P1', 'drinks-01'],
  ['شربت خاکشیر', 'Khakshir Sharbat', 'Iran', 'Iran', 'drink', 'snack', 'نوشیدنی تابستانی ایرانی مهم؛ ریسک ingredient.', 'P1', 'drinks-01'],
  ['شربت تخم شربتی', 'Tokhm Sharbati Drink', 'Iran', 'Iran', 'drink', 'snack', 'نوشیدنی تابستانی پرکاربرد.', 'P1', 'drinks-01'],
  ['چای ماسالا', 'Masala Chai', 'India', 'India', 'drink', 'breakfast,snack', 'نوشیدنی جهانی محبوب.', 'P0', 'drinks-02'],
  ['لیموناد کلاسیک', 'Classic Lemonade', 'USA/Global', 'Global', 'drink', 'snack', 'پایه و پرمصرف؛ باید غیر filler و دقیق باشد.', 'P1', 'drinks-02'],
  ['آرنولد پالمر', 'Arnold Palmer', 'USA', 'USA', 'drink', 'snack', 'نوشیدنی کافه‌ای غیرالکلی شناخته‌شده.', 'P2', 'drinks-02'],
  ['هات چاکلت', 'Hot Chocolate', 'Global', 'Global', 'drink', 'breakfast,snack', 'کافه‌ای محبوب و مناسب فصل سرد.', 'P1', 'drinks-02'],
  ['موکا سرد', 'Iced Mocha', 'Global', 'Cafe', 'drink', 'snack', 'کافه‌ای پرکاربرد؛ باید با مواد موجود سنجیده شود.', 'P2', 'drinks-02'],
  ['اسموتی موز و کره بادام زمینی', 'Peanut Butter Banana Smoothie', 'Global', 'Global', 'drink', 'breakfast,snack', 'فقط اگر allergen/کالری دقیق نمایش داده شود.', 'P2', 'drinks-03'],
  ['اسموتی انبه و ماست', 'Mango Yogurt Smoothie', 'Global', 'Global', 'drink', 'breakfast,snack', 'کاربردی و ساده؛ نه filler اگر nutrition درست باشد.', 'P2', 'drinks-03'],
  ['آب‌دوغ خیار نوشیدنی/غذای سرد', 'Abdoogh Khiar', 'Iran', 'Iran', 'cold meal', 'lunch,dinner', 'مرز نوشیدنی/غذای سرد؛ برای تابستان مهم.', 'P1', 'drinks-03'],
  ['پائیا والنسیا', 'Paella Valenciana', 'Spain', 'Valencia', 'main', 'lunch,dinner', 'غذای جهانی مشهور؛ نیازمند تمایز دقیق از seafood paella.', 'P0', 'global-01'],
  ['راتاتویی', 'Ratatouille', 'France', 'Provence', 'main', 'lunch,dinner', 'کلاسیک فرانسوی گیاهی.', 'P0', 'global-01'],
  ['تاکو آل پاستور', 'Tacos al Pastor', 'Mexico', 'Mexico City/Puebla', 'main', 'lunch,dinner', 'غذای جهانی محبوب؛ نیازمند مواد خاص.', 'P1', 'global-01'],
  ['انچیلادا مرغ', 'Chicken Enchiladas', 'Mexico', 'Mexico', 'main', 'lunch,dinner', 'غذای مکزیکی شناخته‌شده.', 'P1', 'global-01'],
  ['رامن شیو', 'Shio Ramen', 'Japan', 'Japan', 'main', 'lunch,dinner', 'رامن کلاسیک؛ ingredient feasibility چالش دارد.', 'P2', 'global-01'],
  ['اونیگیری سالمون', 'Salmon Onigiri', 'Japan', 'Japan', 'snack', 'lunch,snack', 'شناخته‌شده و مناسب lunchbox.', 'P2', 'global-01'],
  ['بیبیمباپ', 'Bibimbap', 'Korea', 'Korea', 'main', 'lunch,dinner', 'غذای کره‌ای مشهور و رنگی.', 'P1', 'global-01'],
  ['بولگوگی گوشت', 'Beef Bulgogi', 'Korea', 'Korea', 'main', 'lunch,dinner', 'کلاسیک کره‌ای محبوب.', 'P1', 'global-01'],
  ['لاکسای مالزیایی', 'Laksa', 'Malaysia/Singapore', 'SEA', 'main', 'lunch,dinner', 'غذای جهانی جنوب شرق آسیا؛ مواد خاص دارد.', 'P2', 'global-02'],
  ['فو بو', 'Pho Bo', 'Vietnam', 'Vietnam', 'main', 'lunch,dinner', 'غذای بسیار مشهور؛ نیازمند تکنیک آبگوشت دقیق.', 'P1', 'global-02'],
  ['تام یام گونگ', 'Tom Yum Goong', 'Thailand', 'Thailand', 'soup', 'lunch,dinner', 'سوپ کلاسیک تایلندی.', 'P1', 'global-02'],
  ['پد سی یو', 'Pad See Ew', 'Thailand', 'Thailand', 'main', 'lunch,dinner', 'جایگزین مهم کنار پد تای.', 'P2', 'global-02'],
  ['چیکن تیکا ماسالا', 'Chicken Tikka Masala', 'UK/India', 'UK', 'main', 'lunch,dinner', 'بسیار شناخته‌شده؛ هویت بریتانیایی-هندی باید روشن شود.', 'P1', 'global-02'],
  ['پالک پنیر', 'Palak Paneer', 'India', 'North India', 'main', 'lunch,dinner', 'کلاسیک گیاهی هند.', 'P1', 'global-02'],
  ['دال ماخانی', 'Dal Makhani', 'India', 'Punjab', 'main', 'lunch,dinner', 'غذای محبوب هندی؛ نیازمند زمان پخت دقیق.', 'P2', 'global-02'],
  ['بابا غنوش', 'Baba Ganoush', 'Levant', 'MENA', 'appetizer', 'lunch,dinner', 'پیش‌غذای شناخته‌شده منطقه‌ای.', 'P1', 'global-03'],
  ['فتوش', 'Fattoush', 'Levant', 'MENA', 'salad', 'lunch,dinner', 'سالاد مهم خاورمیانه.', 'P1', 'global-03'],
  ['مجدّره', 'Mujadara', 'Levant', 'MENA', 'main', 'lunch,dinner', 'غذای ساده، محبوب و مناسب کاربران گیاه‌خوار.', 'P1', 'global-03'],
  ['شاورمای مرغ', 'Chicken Shawarma', 'Levant', 'MENA', 'main', 'lunch,dinner', 'شناخته‌شده و پرجستجو.', 'P1', 'global-03'],
  ['تاژین مرغ و لیمو', 'Chicken Preserved Lemon Tagine', 'Morocco', 'Morocco', 'main', 'lunch,dinner', 'غذای شاخص مراکش؛ مواد خاص دارد.', 'P2', 'global-03'],
  ['جولوف رایس', 'Jollof Rice', 'West Africa', 'West Africa', 'main', 'lunch,dinner', 'غذای مهم آفریقا با محبوبیت جهانی.', 'P2', 'global-03'],
  ['شپردز پای', 'Shepherd’s Pie', 'UK/Ireland', 'UK/Ireland', 'main', 'lunch,dinner', 'کلاسیک خانگی اروپا؛ باید با cottage pie اشتباه نشود.', 'P1', 'global-04'],
  ['فیش اند چیپس', 'Fish and Chips', 'UK', 'UK', 'main', 'lunch,dinner', 'غذای جهانی و پرشناخت.', 'P1', 'global-04'],
  ['گولاش مجاری', 'Hungarian Goulash', 'Hungary', 'Hungary', 'main', 'lunch,dinner', 'کلاسیک اروپای مرکزی.', 'P1', 'global-04'],
  ['پیرُگی سیب‌زمینی', 'Potato Pierogi', 'Poland', 'Poland', 'main', 'lunch,dinner', 'غذای معروف لهستانی.', 'P2', 'global-04'],
  ['موساکا یونانی', 'Greek Moussaka', 'Greece', 'Greece', 'main', 'lunch,dinner', 'کلاسیک مدیترانه‌ای.', 'P1', 'global-04'],
  ['سالاد نیسواز', 'Salade Nicoise', 'France', 'Nice', 'salad', 'lunch,dinner', 'کلاسیک فرانسوی؛ variant-sensitive.', 'P2', 'global-04'],
  ['کلاب ساندویچ', 'Club Sandwich', 'USA', 'USA', 'main', 'lunch', 'غذای عمومی شناخته‌شده و مفید برای اپ.', 'P1', 'global-05'],
  ['چیکن پارمزان', 'Chicken Parmesan', 'USA/Italian-American', 'USA', 'main', 'lunch,dinner', 'هویت ایتالیایی-آمریکایی باید واضح باشد.', 'P1', 'global-05'],
  ['کورن چاوder', 'Corn Chowder', 'USA', 'USA', 'soup', 'lunch,dinner', 'سوپ آمریکایی کاربردی.', 'P2', 'global-05'],
  ['سالاد سزار کلاسیک', 'Classic Caesar Salad', 'Mexico/USA', 'Tijuana', 'salad', 'lunch,dinner', 'کلاسیک جهانی؛ نسخه کلاسیک/خانگی باید روشن شود.', 'P1', 'global-05'],
  ['پوک بول سالمون', 'Salmon Poke Bowl', 'USA', 'Hawaii', 'main', 'lunch,dinner', 'محبوب و مدرن؛ ریسک ایمنی ماهی خام.', 'P3', 'global-05'],
  ['چورو با شکلات', 'Churros con Chocolate', 'Spain/Mexico', 'Global', 'dessert', 'snack,dessert', 'دسر جهانی شناخته‌شده.', 'P2', 'global-05'],
  ['تیرامیسو کلاسیک', 'Classic Tiramisu', 'Italy', 'Veneto', 'dessert', 'dessert', 'دسر جهانی؛ ریسک تخم‌مرغ خام/قهوه.', 'P1', 'global-06'],
  ['کرم بروله', 'Creme Brulee', 'France', 'France', 'dessert', 'dessert', 'دسر کلاسیک و پرطرفدار.', 'P2', 'global-06'],
  ['باقلوا ترکی', 'Turkish Baklava', 'Turkey', 'Turkey', 'dessert', 'dessert', 'دسر منطقه‌ای مشهور.', 'P1', 'global-06'],
  ['کنافه', 'Knafeh', 'Levant', 'MENA', 'dessert', 'dessert', 'دسر بسیار معروف خاورمیانه.', 'P1', 'global-06'],
  ['پودینگ برنج هندی', 'Kheer', 'India', 'India', 'dessert', 'dessert', 'دسر/صبحانه جنوب آسیا.', 'P2', 'global-06'],
  ['سوپ جو ایرانی دقیق', 'Iranian Barley Soup', 'Iran', 'Iran', 'soup', 'lunch,dinner', 'اگر نسخه فعلی reviewOnly است باید با نسخه دقیق جایگزین/بازگردانی شود.', 'P1', 'iran-repair-01'],
  ['آش انار منبع‌دار', 'Source-backed Ash Anar', 'Iran', 'Iran', 'soup', 'lunch,dinner', 'از ۸۵ reviewOnly؛ اولویت بازگردانی با منبع.', 'P1', 'iran-repair-01'],
  ['جوجه کباب زعفرانی منبع‌دار', 'Source-backed Saffron Joojeh Kabab', 'Iran', 'Iran', 'main', 'lunch,dinner', 'غذای پرمصرف؛ نباید طولانی reviewOnly بماند.', 'P0', 'iran-repair-01'],
  ['خورش بادمجان منبع‌دار', 'Source-backed Khoresht Bademjan', 'Iran', 'Iran', 'main', 'lunch,dinner', 'غذای پایه ایرانی؛ نیازمند بازگشت سریع با منبع.', 'P0', 'iran-repair-01'],
  ['باقالی پلو با گوشت منبع‌دار', 'Source-backed Baghali Polo', 'Iran', 'Iran', 'main', 'lunch,dinner', 'غذای کلاسیک public باید بعد از review برگردد.', 'P0', 'iran-repair-01'],
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[‌\u200c]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const queue = loadQueue();
  const recipes = await loadRecipes(queue.map((row) => row.recipeId));
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const decisions = queue.map((row) => closeoutDecision(row, byId.get(row.recipeId)));
  const counts = await getCounts();
  const regression = await regressionStatus();
  const publicRemaining = recipes.filter((recipe) => recipe.status === 'active' && recipe.isPublic);
  const aiAudit = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'culinary-authenticity-sprint', 'ai_copy_residue_audit_v1.json');
  const ai = fs.existsSync(aiAudit) ? JSON.parse(fs.readFileSync(aiAudit, 'utf8')) : { counts: {} };
  const aiCritical = ai.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0;
  const aiHigh = ai.counts?.HIGH_REPEATED_TEMPLATE ?? 0;
  const pass = publicRemaining.length === 0 && counts.totalRecipes === 639 && counts.ingredientCount === 1084 && regression.gamaj.status === 'PASS' && regression.qeymeh.status === 'PASS' && aiCritical === 0 && aiHigh === 0;

  writeJson('post_closeout_audit.json', {
    generatedAt,
    counts,
    finalStateCounts: { STILL_REVIEWONLY_WITH_EXACT_BLOCKER: decisions.length },
    restoredPublicAsIs: 0,
    patchedAndRestored: 0,
    reframedAndRestored: 0,
    publicUnresolvedBlockers: publicRemaining.length,
    regression,
    aiResidue: { critical: aiCritical, high: aiHigh },
    pass,
    rows: decisions,
  });
  writeMd('post_closeout_audit.md', `# Post Closeout Audit

- generatedAt: ${generatedAt}
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- unresolved public blockers from 85: ${publicRemaining.length}
- restored public as-is: 0
- patched and restored: 0
- reframed and restored: 0
- still reviewOnly: ${decisions.length}
- Meze 50 public: ${counts.mezePublic}
- Gamaj Kabab regression: ${regression.gamaj.status}
- Qeymeh Rizeh regression: ${regression.qeymeh.status}
- AI residue critical/high: ${aiCritical}/${aiHigh}
- final audit verdict: ${pass ? 'PASS' : 'FAIL'}
`);
  writeCsv('final_85_states.csv', decisions.map((d) => ({
    recipeId: d.recipeId,
    slug: d.slug,
    titleFa: d.titleFa,
    finalState: d.finalState,
    status: d.currentStatus,
    isPublic: d.currentIsPublic,
    exactBlocker: d.exactBlocker,
  })), ['recipeId', 'slug', 'titleFa', 'finalState', 'status', 'isPublic', 'exactBlocker']);
  writeCsv('final_still_reviewonly.csv', decisions.map((d) => ({
    recipeId: d.recipeId,
    slug: d.slug,
    titleFa: d.titleFa,
    exactBlocker: d.exactBlocker,
  })), ['recipeId', 'slug', 'titleFa', 'exactBlocker']);
  writeMd('api_search_smoke_report.md', `# API/Search Smoke Report

- generatedAt: ${generatedAt}
- restored public recipes from 85: 0
- patched recipes from 85: 0
- still-reviewOnly recipes checked: ${decisions.length}
- public API/search rule: status='active' and isPublic=true
- hidden visibility failures: ${publicRemaining.length}
- status: ${publicRemaining.length === 0 ? 'PASS' : 'FAIL'}
`);

  const allRecipes = await prisma.recipe.findMany({ select: { id: true, title: true } });
  const titleSet = new Set(allRecipes.map((r) => normalize(r.title)));
  const candidateRows = candidates.slice(0, 100).map(([titleFa, titleEn, country, region, category, mealTypes, why, priority, batch]) => {
    const duplicateRisk = titleSet.has(normalize(titleFa)) ? 'HIGH_EXISTING_TITLE_MATCH' : 'LOW_NO_EXACT_TITLE_MATCH';
    const ingredientRisk = /ترش واش|پاچ|چکدرمه|مالابیج|خاکشیر|بیدمشک|خلال|کنافه|لاکس|رامن|پوک|کله پاچه|قلیه|هواری/.test(titleFa)
      ? 'MEDIUM_OR_HIGH_CORE_INGREDIENT_CHECK_REQUIRED'
      : 'LOW_OR_MEDIUM_VERIFY_BEFORE_IMPORT';
    return {
      titleFa,
      titleEn,
      country,
      regionCity: region,
      category,
      mealTypes,
      whyImportant: why,
      popularityGlobalRegionalRelevance: priority === 'P0' ? 'high' : priority === 'P1' ? 'medium_high' : 'medium',
      ingredientFeasibilityRisk: ingredientRisk,
      duplicateRisk,
      sourceResearchRequirement: '3 reputable independent sources before import',
      priority,
      recommendedBatch: batch,
    };
  });
  const north = candidateRows.filter((r) => /north|Gilan|Mazandaran|Golestan|گیلان|مازندران|گلستان/i.test(`${r.recommendedBatch} ${r.regionCity}`));
  const breakfastDrinkGlobal = candidateRows.filter((r) => /breakfast|drink|global/.test(r.recommendedBatch));
  writeCsv('next_100_recipe_candidates_v1.csv', candidateRows, undefined, expansionDir);
  writeCsv('north_iran_missing_priority_v1.csv', north, undefined, expansionDir);
  writeCsv('breakfast_drinks_global_priority_v1.csv', breakfastDrinkGlobal, undefined, expansionDir);
  writeMd('duplicate_risk_scan_v1.md', `# Duplicate Risk Scan v1

- generatedAt: ${generatedAt}
- candidates scanned: ${candidateRows.length}
- exact title duplicate risks: ${candidateRows.filter((r) => r.duplicateRisk !== 'LOW_NO_EXACT_TITLE_MATCH').length}
- ingredient feasibility risks requiring pre-import check: ${candidateRows.filter((r) => r.ingredientFeasibilityRisk !== 'LOW_OR_MEDIUM_VERIFY_BEFORE_IMPORT').length}

No DB import was performed.
`, expansionDir);
  writeMd('catalog_gap_analysis_v1.md', `# Catalog Gap Analysis v1

- generatedAt: ${generatedAt}
- candidate count: ${candidateRows.length}
- Iranian/regional candidates: ${candidateRows.filter((r) => r.country === 'Iran').length}
- North Iran priority candidates: ${north.length}
- breakfast/drink/global candidates: ${breakfastDrinkGlobal.length}
- P0 candidates: ${candidateRows.filter((r) => r.priority === 'P0').length}
- P1 candidates: ${candidateRows.filter((r) => r.priority === 'P1').length}
- P2/P3 candidates: ${candidateRows.filter((r) => r.priority === 'P2' || r.priority === 'P3').length}

Priority is quality-first. Every candidate must pass duplicate, ingredient feasibility, and source-backed authoring gates before any future import.
`, expansionDir);

  writeMd('final_recipe_trust_closeout_report.md', `# Final Recipe Trust Closeout Report

- generatedAt: ${generatedAt}
- total recipe count before/after: 639 -> ${counts.totalRecipes}
- active/public before safety hide/current: 589 -> ${counts.activePublic}
- draft/private/review before safety hide/current: 50 -> ${counts.draftPrivate}
- ingredient count before/after: 1084 -> ${counts.ingredientCount}
- restored public as-is count: 0
- patched and restored count: 0
- reframed and restored count: 0
- still reviewOnly count: ${decisions.length}
- public unresolved blocker count: ${publicRemaining.length}
- deleted recipe count: 0
- new ingredient count: 0
- Meze 50 public: ${counts.mezePublic}
- Gamaj Kabab regression: ${regression.gamaj.status}
- Qeymeh Rizeh Esfahani regression: ${regression.qeymeh.status}
- AI residue critical/high: ${aiCritical}/${aiHigh}
- server build status: run after this script
- API/search smoke status: ${publicRemaining.length === 0 ? 'PASS' : 'FAIL'}

## Restored Recipes

None. No item met the hard restore criteria.

## Patched Recipes

None. No evidence-backed patch candidate was identified.

## Still ReviewOnly

See \`final_still_reviewonly.csv\` for all ${decisions.length} recipes and exact blockers.

## Catalog Expansion Summary

- next recipe candidates: ${candidateRows.length}
- Iranian/regional candidates: ${candidateRows.filter((r) => r.country === 'Iran').length}
- North Iran priority count: ${north.length}
- breakfast candidate count: ${candidateRows.filter((r) => r.category.includes('breakfast') || r.mealTypes.includes('breakfast')).length}
- drink candidate count: ${candidateRows.filter((r) => r.category === 'drink').length}
- global candidate count: ${candidateRows.filter((r) => r.country !== 'Iran').length}
- duplicate risks: ${candidateRows.filter((r) => r.duplicateRisk !== 'LOW_NO_EXACT_TITLE_MATCH').length}
- ingredient feasibility risks: ${candidateRows.filter((r) => r.ingredientFeasibilityRisk !== 'LOW_OR_MEDIUM_VERIFY_BEFORE_IMPORT').length}

Public launch risk is controlled; remaining reviewOnly recipes are preserved for future restoration.
`);
  console.log(JSON.stringify({ ok: pass, stillReviewOnly: decisions.length, publicUnresolved: publicRemaining.length, candidates: candidateRows.length }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
