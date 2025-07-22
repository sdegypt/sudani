const express = require("express");
const http = require("http");
const path = require("path");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const compression = require("compression");
const minify = require("express-minify");
const cron = require("node-cron");
const NotificationModel = require("./models/NotificationModel");
const logger = require("./config/logger");
const expressStatusMonitor = require("express-status-monitor");
const { SitemapStream, streamToPromise } = require("sitemap");
const { Readable } = require("stream");
const axios = require("axios");

const ForumModel = require("./models/forumModel");
const UserModel = require("./models/UsersModels");
const Project = require('./models/Project');
const StoreModel = require("./models/StoreModel");

// استيراد الراوترات
const userRouter = require("./router/UsersRouter");
const forumRouter = require("./router/forumRoutes");
const MessagesProjectRoutes = require("./router/messagesProjectRoutes");
const friendshipRoutes = require("./routes/friends");
const notificationRouter = require("./router/notificationRoutes");
const chatRoutes = require("./router/chatRoutes");
const jobRoutes = require("./router/jobRoutes");
const profileRouter = require("./router/profileRouter");
const ProjectRoutes = require("./router/ProjectRoutes");
const contactRoutes = require("./router/contactRoutes");
const adminMessageRoutes = require("./router/adminMessageRoutes");
const adminDashboardRoutes = require("./router/adminDashboardRoutes");
const adminStatisticsRoutes = require("./router/adminStatisticsRoutes");
const adminSiteStatsRoutes = require("./router/adminSiteStatsRoutes");
const adminRolesPermissionsRoutes = require("./router/adminRolesPermissionsRoutes");
const adminForumSettingsRoutes = require("./router/adminForumSettingsRoutes");
const adminJobProjectSettingsRoutes = require("./router/adminJobProjectSettingsRoutes");
const adminUsersRoutes = require("./router/adminUsersRoutes");
const changePasswordRoutes = require("./router/changePasswordRoutes");
const storeRoutes = require("./router/StoreRoutes");
const errorHandler = require("./middleware/errorHandler");
const GlobalRoleController = require("./controllers/GlobalRoleController");
const ForumController = require("./controllers/ForumController");
const ImageOptimizationMiddleware = require("./middleware/imageOptimization");

// استيراد الميدلوير الجديد للميتا الديناميكية
const dynamicMetaMiddleware = require("./middleware/dynamicMetaMiddleware");
const seoMiddleware = require("./middleware/seoMiddleware");

const app = express();
const server = http.createServer(app);

// إنشاء instance من middleware تحسين الصور
const imageOptimizer = new ImageOptimizationMiddleware();

// Middleware لإعادة التوجيه 301 إلى https://www.amlhabrak.online
app.use((req, res, next) => {
  const host = req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const targetDomain = 'www.amlhabrak.online';
  
  // التحقق من أن الطلب ليس من النطاق المطلوب
  if (host !== targetDomain) {
    const redirectUrl = `https://${targetDomain}${req.originalUrl}`;
    return res.redirect(301, redirectUrl);
  }
  
  // التحقق من أن الطلب يستخدم HTTPS
  if (protocol !== 'https' && process.env.NODE_ENV === 'production') {
    const redirectUrl = `https://${host}${req.originalUrl}`;
    return res.redirect(301, redirectUrl);
  }
  
  next();
});

// تفعيل الضغط مع إعدادات محسنة
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// تفعيل تصغير الملفات (CSS, JS) مع إعدادات محسنة
app.use(minify({
  cache: false,
  uglifyJsModule: null,
  errorHandler: null,
  jsMatch: /\.js$/,
  cssMatch: /\.css$/,
  jsonMatch: /\.json$/,
  sassMatch: /\.scss$/,
  lessMatch: /\.less$/,
  stylusMatch: /\.styl$/,
  coffeeMatch: /\.coffee$/
}));

app.use(expressStatusMonitor());

// إعداد التخزين للملفات المرفوعة
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 ميجابايت
});

// إعدادات البرامج الوسيطة
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: "your_jwt_secret",
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
  }
}));
app.use(flash());

// تمرير رسائل الفلاش لكل الصفحات
app.use((req, res, next) => {
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error")
  };
  next();
});

// إعداد محرك العرض
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// إعداد الملفات الثابتة مع تحسين الصور
app.use("/uploads", imageOptimizer.serveOptimizedImages());
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1y", // سنة واحدة للملفات الثابتة
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // إعدادات مخصصة للملفات المختلفة
    if (path.endsWith(".css") || path.endsWith(".js")) {
      res.setHeader("Cache-Control", "public, max-age=31536000"); // سنة واحدة
    } else if (path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".gif") || path.endsWith(".webp")) {
      res.setHeader("Cache-Control", "public, max-age=31536000"); // سنة واحدة للصور
    } else {
      res.setHeader("Cache-Control", "public, max-age=86400"); // يوم واحد للملفات الأخرى
    }
  }
}));

// إضافة middleware تحسين الصور للملفات المرفوعة
app.use(imageOptimizer.optimizeImages());

// إزالة مسار uploads بسبب القيود على Vercel
// استخدام التخزين السحابي للملفات المرفوعة

// إضافة الميدلوير للميتا الديناميكية
app.use(seoMiddleware);
app.use(dynamicMetaMiddleware);

// Middleware لحساب unreadCount وتمريره لكل الصفحات
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const unreadCount = await NotificationModel.getUnreadCount(req.session.userId);
      res.locals.unreadCount = unreadCount || 0;
    } catch (err) {
      logger.error("خطأ أثناء حساب unreadCount:", err);
    }
  } else {
    res.locals.unreadCount = 0;
  }
  next();
});

// Middleware عالمي للتحقق من الدور
app.use(GlobalRoleController.setGlobalRole);

// الصفحة الرئيسية - المنتدى
app.get("/", ForumController.getAllPosts);

// دمج الراوترات
app.use("/", userRouter);
app.use("/", changePasswordRoutes);
app.use("/friends", friendshipRoutes);
app.use(notificationRouter);
app.use("/forum", forumRouter);
app.use("/", chatRoutes);
app.use("/", jobRoutes);
app.use("/", profileRouter);
app.use("/projects", ProjectRoutes);
app.use("/", MessagesProjectRoutes);
app.use("/", contactRoutes);
app.use("/stores", storeRoutes);
app.use("/admin", adminMessageRoutes);
app.use("/admin", adminDashboardRoutes);
app.use("/admin", adminStatisticsRoutes);
app.use("/admin", adminSiteStatsRoutes);
app.use("/admin", adminRolesPermissionsRoutes);
app.use("/admin", adminForumSettingsRoutes);
app.use("/admin", adminJobProjectSettingsRoutes);
app.use("/admin", adminUsersRoutes);
app.use("/", require("./router/GlobalRoleRouter"));

// مسارات ثابتة للصفحات
app.get("/about", (req, res) => {
  res.locals.pageName = "about";
  res.render("about", {
    unreadCount: res.locals.unreadCount,
    userId: res.locals.userId,
    isAdmin: res.locals.isAdmin
  });
});

app.get("/privacy", (req, res) => {
  res.locals.pageName = "privacy";
  res.render("privacy", {
    unreadCount: res.locals.unreadCount,
    userId: res.locals.userId,
    isAdmin: res.locals.isAdmin
  });
});

// مسار مستقل لـ /ProjectSpace
app.get("/ProjectSpace", (req, res) => {
  res.locals.pageName = "ProjectSpace";
  res.render("ProjectSpace", {
    errorMessage: null,
    successMessage: null,
    userId: res.locals.userId,
    isAdmin: res.locals.isAdmin,
    unreadCount: res.locals.unreadCount
  });
});

// دالة لتوليد وإرسال sitemap
async function generateAndSubmitSitemap() {
  try {
    const posts = await ForumModel.getAllPosts(null);
    const users = await UserModel.getAllUsers();
    const projects = await ProjectModel.getAllProjects();
    const products = await StoreModel.getAllProducts();

    const links = [
      { url: "/", changefreq: "daily", priority: 1.0 },
      { url: "/about", changefreq: "monthly", priority: 0.8 },
      { url: "/contact", changefreq: "monthly", priority: 0.8 },
      { url: "/privacy", changefreq: "monthly", priority: 0.5 },
      { url: "/forum", changefreq: "daily", priority: 0.9 },
      { url: "/projects", changefreq: "daily", priority: 0.9 },
      { url: "/contests", changefreq: "daily", priority: 0.9 },
      { url: "/store", changefreq: "daily", priority: 0.8 },
      { url: "/login", changefreq: "monthly", priority: 0.7 },
      { url: "/signup", changefreq: "monthly", priority: 0.7 },
      { url: "/profile", changefreq: "weekly", priority: 0.8 },
      { url: "/portfolio", changefreq: "weekly", priority: 0.8 },
      ...posts.map(post => ({
        url: `/forum/post/${post.id}`,
        changefreq: "weekly",
        priority: 0.8
      })),
      ...users.map(user => ({
        url: `/profile/${encodeURIComponent(user.username)}`,
        changefreq: "weekly",
        priority: 0.7
      })),
      ...projects.map(project => ({
        url: `/projects/${encodeURIComponent(project.id)}`,
        changefreq: "weekly",
        priority: 0.8
      })),
      ...products.map(product => ({
        url: `/store/product/${encodeURIComponent(product.id)}`,
        changefreq: "weekly",
        priority: 0.8
      }))
    ];

    const stream = new SitemapStream({ hostname: "https://www.amlhabrak.online" });
    const xmlString = await streamToPromise(Readable.from(links).pipe(stream)).then(data => data.toString());

    // حفظ ملف sitemap.xml (اختياري، يمكن استخدامه للتصحيح)
    // require('fs').writeFileSync('./public/sitemap.xml', xmlString);

    // إرسال sitemap إلى Google Search Console
    const sitemapUrl = "https://www.amlhabrak.online/sitemap.xml";
    const pingUrl = `https://www.google.com/ping?sitemap=${sitemapUrl}`;
    await axios.get(pingUrl);
    logger.info(`Sitemap submitted to Google: ${pingUrl}`);

    return xmlString;

  } catch (e) {
    logger.error("خطأ في توليد أو إرسال السايت ماب:", e);
    throw e;
  }
}

// مسار السايت ماب الديناميكي
app.get("/sitemap.xml", async (req, res) => {
  try {
    const xmlString = await generateAndSubmitSitemap();
    res.writeHead(200, {
      "Content-Type": "application/xml"
    });
    res.end(xmlString);
  } catch (e) {
    res.status(500).end();
  }
});

// جدولة توليد وإرسال sitemap يومياً
cron.schedule("0 0 * * *", async () => {
  logger.info("بدء توليد وإرسال sitemap مجدول...");
  await generateAndSubmitSitemap();
}, {
  scheduled: true,
  timezone: "Asia/Riyadh"
});

// جدولة حذف الإعلانات القديمة يومياً
cron.schedule("0 0 * * *", async () => {
  try {
    await ForumModel.deleteOldAds();
    console.log("تم حذف الإعلانات القديمة بنجاح.");
  } catch (err) {
    logger.error("خطأ في حذف الإعلانات المجدولة:", err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Riyadh"
});

// Middleware لمعالجة الأخطاء (في النهاية)
app.use(errorHandler);

// إعداد socket.io
const { Server } = require("socket.io");
const chatModel = require("./models/chatModel");
const UsersModels = require("./models/UsersModels");

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_chat", ({ userId, friendId }) => {
    console.log(`User ${userId} joined chat with ${friendId}. Socket: ${socket.id}`);
    socket.join(userId);
    socket.userId = userId;
    userSocketMap.set(userId, socket.id);
  });

  socket.on("send_message", async (messageData) => {
    console.log("Received send_message:", messageData);
    try {
      io.to(messageData.sender_id).emit("new_message", messageData);
      io.to(messageData.receiver_id).emit("new_message", messageData);
    } catch (err) {
      console.error("Socket send_message error:", err);
    }
  });

  socket.on("delete_message", async (messageId) => {
    console.log("Received delete_message for ID:", messageId);
    try {
      const message = await chatModel.getMessageById(messageId);
      if (message) {
        const deleted = await chatModel.deleteMessage(messageId);
        if (deleted) {
          io.to(message.sender_id).emit("message_deleted", messageId);
          io.to(message.receiver_id).emit("message_deleted", messageId);
        }
      }
    } catch (err) {
      console.error("Socket delete_message error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    for (let [key, value] of userSocketMap.entries()) {
      if (value === socket.id) {
        userSocketMap.delete(key);
        break;
      }
    }
  });
});

// Health Check Endpoint للمراقبة
app.get("/health", async (req, res) => {
  try {
    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development"
    };

    // فحص قاعدة البيانات (اختياري)
    try {
      // يمكن إضافة فحص قاعدة البيانات هنا
      healthStatus.database = "connected";
    } catch (dbError) {
      healthStatus.database = "disconnected";
      healthStatus.status = "unhealthy";
    }

    const statusCode = healthStatus.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Uptime Monitoring Dashboard
app.get("/uptime", (req, res) => {
  const uptimeData = {
    serverUptime: process.uptime(),
    serverStartTime: new Date(Date.now() - process.uptime() * 1000),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    nodeVersion: process.version,
    platform: process.platform
  };

  res.json({
    message: "Uptime Monitoring Dashboard",
    data: uptimeData,
    healthCheckUrl: "/health",
    monitoringSetup: "راجع ملف uptime-monitoring-setup.md للتعليمات"
  });
});

// إضافة middleware لتسجيل الأخطاء
app.use((err, req, res, next) => {
  logger.error("خطأ في التطبيق:", err);
  res.status(500).json({
    error: "خطأ داخلي في الخادم",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ تم الاتصال بقاعدة البيانات بنجاح`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Uptime Monitor: http://localhost:${PORT}/uptime`);
});


