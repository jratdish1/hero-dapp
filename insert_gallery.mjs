import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

// Read DB URL from the app's environment
const envContent = readFileSync('/root/hero-dapp/.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) envVars[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
});

const dbUrl = envVars.DATABASE_URL;
if (!dbUrl) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}

const images = [
  // Military service photos - "memories" category
  { title: "On Deck - Combat Ready", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/HJYhjYStzEAWOcjL.jpeg", desc: "Marine on ship deck in full combat gear" },
  { title: "USMC Memorial", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/LmZxcWJvccbGiPQx.jpeg", desc: "United States Marines memorial emblem" },
  { title: "Service Photo", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/gjhAdAVhGAigmMCu.jpeg", desc: "Military service photo" },
  { title: "Brothers in Arms", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/IbScNxnoFpShJuBG.jpeg", desc: "Military service memories" },
  { title: "Service Memory", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/ORzDmgNyNHVAqvvm.jpeg", desc: "Service memory photo" },
  { title: "Mission Photo", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/mUoNjKpbeqFfSasZ.jpeg", desc: "Mission deployment photo" },
  { title: "Field Operations", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/gCgqmwZarQurVkNe.jpeg", desc: "Field operations photo" },
  { title: "Duty Station", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/DzRjNgCEhlacsusW.jpeg", desc: "Duty station photo" },
  { title: "Unit Photo", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/bnEIcdgphtyrMYtg.jpeg", desc: "Unit photo" },
  { title: "Service Days", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/KrgOyXybTngrTcKM.jpeg", desc: "Service days photo" },
  { title: "Marine Corps Dress Blues", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/QklWXoGjdwDmHIQg.jpeg", desc: "Corporal in Marine Corps dress blues" },
  { title: "Deployment Photo", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/JgkfiEZJtDYBxHcB.jpeg", desc: "Deployment photo" },
  { title: "Service Snapshot", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/vqhRZywyAGiyZnCh.jpeg", desc: "Service snapshot" },
  { title: "Military Life", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/ZaUawAeGUBKdTyfe.jpeg", desc: "Military life photo" },
  { title: "Veteran Memories", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/coYONmovnpAqIvGL.jpeg", desc: "Veteran memories" },
  { title: "Semper Fi", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/iSPaNqmyFMvVUIwC.jpeg", desc: "Semper Fidelis - always faithful" },
  { title: "Marine Heritage", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/dcSVLzIPsmHjFsCw.jpeg", desc: "Marine Corps heritage" },
  { title: "Combat Ready", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/gHuGEneIzXEeUvUQ.jpeg", desc: "Combat ready photo" },
  { title: "Service Honor", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/mGJEaUwlevwfHaVt.jpeg", desc: "Service and honor" },
  { title: "Oorah", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/LqtLqzpddKgfKoyy.jpeg", desc: "Marine Corps spirit" },
  // Deployment photos (IMG_6611-6615)
  { title: "Desert Deployment", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/LuDAosxjhdgJJFhv.jpeg", desc: "Desert deployment photo" },
  { title: "Forward Operating Base", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/GQuMvNkwvIwncAjs.jpeg", desc: "Forward operating base" },
  { title: "Mission Ops", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/eAmCqzOHqLouOluE.jpeg", desc: "Mission operations" },
  { title: "Deployed Marines", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/zSjKxylMFWPeERkO.jpeg", desc: "Marines deployed in desert" },
  { title: "Brothers Deployed", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/omVXMKwxUnncLdvG.jpeg", desc: "Brothers deployed together" },
  // HERO project images - "announcements" category
  { title: "HERO Shield Logo", category: "announcements", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/CpzmTJqYEuebqwlc.png", desc: "HERO token shield logo - Built for Veterans by Veterans" },
  { title: "HERO Token PFP", category: "announcements", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/PaVkDUobcLuPUgsF.jpeg", desc: "Official HERO token profile picture" },
  // Community photos
  { title: "HERO Community", category: "photos", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/TgjQDlxmFjYqzXAm.jpeg", desc: "HERO community photo" },
  { title: "VIC Foundation", category: "photos", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/vkQebMLJnAHyCxIz.jpeg", desc: "VIC Foundation community" },
  { title: "HERO Event", category: "photos", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/DkmdmySgxKYWMtVY.jpeg", desc: "HERO community event" },
  { title: "Project Update", category: "announcements", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/poHkYIIzUBoVaEoL.jpeg", desc: "HERO project update" },
  { title: "Development Progress", category: "announcements", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/tyYdClIggrSmeDaq.jpeg", desc: "Development progress screenshot" },
  { title: "Platform Preview", category: "announcements", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/WvVqLHFvvYgWaOPc.jpeg", desc: "Platform preview" },
  { title: "Feature Showcase", category: "announcements", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/jYvrmrmSFjgOXaqz.jpeg", desc: "Feature showcase" },
  { title: "System Overview", category: "announcements", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/YQizXPJiBMqoTOIs.jpeg", desc: "System overview" },
  // Challenge coin / memorabilia
  { title: "Challenge Coin", category: "memories", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/OTHYFmXXmBdrapTy.jpg", desc: "Military challenge coin" },
];

async function main() {
  console.log('Connecting to database...');
  const conn = await createConnection(dbUrl);
  
  // Get or create admin user (userId=1 as fallback)
  const [users] = await conn.execute('SELECT id, name FROM users ORDER BY id LIMIT 1');
  const userId = users.length > 0 ? users[0].id : 1;
  const authorName = users.length > 0 ? users[0].name : 'VETS';
  console.log('Using user: ' + authorName + ' (id=' + userId + ')');
  
  let inserted = 0;
  for (const img of images) {
    try {
      await conn.execute(
        'INSERT INTO media_posts (userId, walletAddress, authorName, category, title, description, mediaType, mediaUrl, mediaKey, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, '0x0000000000000000000000000000000000000000', authorName, img.category, img.title, img.desc, 'image', img.url, 'gallery/' + img.title.replace(/\s+/g, '_').toLowerCase(), 'active']
      );
      inserted++;
      console.log('  + ' + img.title);
    } catch (e) {
      console.error('  X ' + img.title + ': ' + e.message);
    }
  }
  
  console.log('\nInserted ' + inserted + '/' + images.length + ' images into media gallery');
  await conn.end();
}

main().catch(console.error);
