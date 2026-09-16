/**
 * ══════════════════════════════════════════════════════════════════════════════
 * COMPLETE BACKEND ENDPOINT MAP
 * ══════════════════════════════════════════════════════════════════════════════
 * Extracted verbatim from admin-dashboard.html, expert-dashboard.html,
 * admin-login.html and expert-login.html. Paths, HTTP methods, query parameter
 * names and body shapes are reproduced exactly — the Spring Boot backend is the
 * source of truth and none of this may be renamed.
 *
 * Note the two distinct admin order bases, which is NOT a typo in the original:
 *   ORDER_ADMIN  = /admin/orders       (detail + most actions)
 *   ORDER_DELETE = /api/admin/orders   (soft delete + deleted list)
 */

export const API = {
  auth: {
    /** POST { email, password } → AuthResponse. Shared by admin AND expert login. */
    employeeLogin: '/auth/employee/login',
  },

  admin: {
    /** GET → DashboardStats. Also backs the Analytics and Super Dashboard panels. */
    dashboard: '/admin/admin-dashboard',
    /** GET → EmployeeDTO[] */
    employees: '/admin/employees',
    /** GET → EmployeeDTO[] (availability = AVAILABLE) */
    availableExperts: '/admin/experts/available',
    /** GET → RoleDTO[]; POST { name, permissions } to create one. */
    roles: '/admin/roles',
    /**
     * PUT /admin/roles/{roleId}/permissions — body is a BARE ARRAY of
     * permission strings, not an object. Permissions are attached to a ROLE,
     * not to an individual employee.
     */
    rolePermissions: (roleId: number) => `/admin/roles/${roleId}/permissions`,
    /** POST /admin/employee/{id}/status?active= */
    employeeStatus: (id: number) => `/admin/employee/${id}/status`,
    /** POST /admin/employee/{id}/role?roleName= — QUERY PARAM, not a body. */
    employeeRole: (id: number) => `/admin/employee/${id}/role`,
    /** POST /emp/create?name=&email=&password=&role=[&managerId=] — query params. */
    createEmployee: '/emp/create',

    /**
     * Coupons. AdminController is @RequestMapping("/admin"), so these are
     * /admin/coupons/* — NOT the /coupons/* shown in the API notes, which
     * would 404.
     */
    coupons: {
      create: '/admin/coupons/create',
      all: '/admin/coupons/all',
      /** PUT to update, DELETE to remove. */
      byId: (id: number) => `/admin/coupons/${id}`,
      /** PATCH — returns the updated entity; do not guess the new state. */
      toggle: (id: number) => `/admin/coupons/${id}/toggle`,
    },
  },

  orders: {
    /** GET ?page=&size=&sort= → Page<OrderDTO>. Also ?keyword=&searchType= */
    all: '/orders/all',
    /** GET /admin/orders/{id} → OrderDetailDTO */
    detail: (id: number) => `/admin/orders/${id}`,
    /** POST /admin/orders/{id}/assign — body { expertId, expertDeadline } */
    assign: (id: number) => `/admin/orders/${id}/assign`,
    /** POST /admin/orders/{id}/reassign — body { expertId, expertDeadline } */
    reassign: (id: number) => `/admin/orders/${id}/reassign`,
    /** POST /admin/orders/{id}/unassign */
    unassign: (id: number) => `/admin/orders/${id}/unassign`,
    /** POST /admin/orders/{id}/start-review */
    startReview: (id: number) => `/admin/orders/${id}/start-review`,
    /** POST /admin/orders/{id}/set-price?price= */
    setPrice: (id: number, price: number) => `/admin/orders/${id}/set-price?price=${price}`,
    /** POST /admin/orders/{id}/complete */
    complete: (id: number) => `/admin/orders/${id}/complete`,
    /** POST /admin/orders/{id}/payment-link */
    paymentLink: (id: number) => `/admin/orders/${id}/payment-link`,
    /** PUT /admin/orders/{id}/deadlines — body { clientDeadline, expertDeadline }. */
    deadlines: (id: number) => `/admin/orders/${id}/deadlines`,
    /**
     * PUT /admin/orders/{id}/update — partial update. Only changed keys are
     * sent; an absent key means "leave unchanged" on the server.
     */
    update: (id: number) => `/admin/orders/${id}/update`,
    /** GET /admin/orders/{id}/installments */
    installments: (id: number) => `/admin/orders/${id}/installments`,
    /** POST multipart @ModelAttribute AdminCreateOrderRequestDTO + files */
    create: '/admin/orders/create',
    /** DELETE /api/admin/orders/{id}?adminId=&reason= — different base path */
    softDelete: (id: number) => `/api/admin/orders/${id}`,
    /** GET /api/admin/orders/deleted */
    deleted: '/api/admin/orders/deleted',
  },

  expert: {
    /** GET → { totalAssigned, inProgress, completed } */
    dashboard: '/expert/dashboard',
    /** GET ?page=&size= → Page<OrderDTO>; `deadline` here is the EXPERT deadline */
    orders: '/expert/orders',
    /** GET /expert/orders/{id}/details → ExpertOrderDetailDTO */
    orderDetail: (id: number) => `/expert/orders/${id}/details`,
    /** POST /expert/orders/{id}/start */
    startWork: (id: number) => `/expert/orders/${id}/start`,
    /** POST /expert/orders/{id}/submit — multipart, field name `files` */
    submitWork: (id: number) => `/expert/orders/${id}/submit`,
    /** POST /expert/status?status=AvailabilityStatus */
    status: '/expert/status',
    /** GET → EmployeeDTO */
    profile: '/expert/profile',
    /** GET → { assigned, inProgress, submitted, completed, overdue } */
    stats: '/expert/stats',
    /** GET → OrderDTO[] */
    dueToday: '/expert/orders/due-today',
    /** GET → OrderDTO[] */
    overdue: '/expert/orders/overdue',
  },

  files: {
    /** GET /files/admin/order/{orderId}?page=&size= → Page<FileDTO> */
    adminOrder: (orderId: number) => `/files/admin/order/${orderId}`,
    /** GET /files/student/order/{orderId} → Page<FileDTO> */
    studentOrder: (orderId: number) => `/files/student/order/${orderId}`,
    /** GET /files/{id}/download → { downloadUrl } */
    download: (fileId: number) => `/files/${fileId}/download`,
    /** GET /files/{id}/preview → { previewUrl } */
    preview: (fileId: number) => `/files/${fileId}/preview`,
    /** POST multipart — fields: orderId, files[] */
    employeeUpload: '/files/employee/upload',
  },

  payments: {
    /** GET /payments/order/{orderId} → PaymentDTO[] */
    byOrder: (orderId: number) => `/payments/order/${orderId}`,
    /** GET /payments/summary?studentId= */
    summary: '/payments/summary',
    /** POST /admin/payments/manual-verification?orderId=&paymentIntentId= */
    manualVerification: '/admin/payments/manual-verification',
  },

  installments: {
    /** POST /installments/create/{orderId} */
    create: (orderId: number) => `/installments/create/${orderId}`,
    /** GET → InstallmentDTO[] */
    due: '/installments/due',
    /** GET → InstallmentDTO[] */
    overdue: '/installments/overdue',
    /** POST /admin/installments/{id}/update */
    update: (installmentId: number) => `/admin/installments/${installmentId}/update`,
    /** POST /admin/installments/{id}/payment-link */
    paymentLink: (installmentId: number) => `/admin/installments/${installmentId}/payment-link`,
    /**
     * POST /admin/installments/{orderId}/recreate — takes a JSON BODY
     * (StudentInstallmentRequestDTO), the same shape as create. NOT query
     * params. `preferredDates` must always be sent, at minimum as [].
     */
    recreate: (orderId: number) => `/admin/installments/${orderId}/recreate`,
  },

  students: {
    /** POST /student/admin/{id}/status?active= */
    toggleStatus: (studentId: number) => `/student/admin/${studentId}/status`,
    /** POST /wallet/admin/adjust?userId=&amount=&reason= */
    walletAdjust: '/wallet/admin/adjust',

    /**
     * SPECULATIVE. The backend exposes no student-profile endpoint. The legacy
     * page tries each of these in order and keeps the first that answers with
     * anything useful; all four 404 on the deployments I can see. Preserved
     * verbatim so that if any of them exists, the data still appears.
     */
    profileCandidates: (studentId: number) => [
      `/admin/students/${studentId}`,
      `/admin/student/${studentId}`,
      `/admin/student/${studentId}/profile`,
      `/student/admin/${studentId}/profile`,
    ],

    /** SPECULATIVE, same caveat as above. */
    walletCandidates: (studentId: number) => [
      `/wallet/admin/student/${studentId}`,
      `/admin/wallet/${studentId}`,
      `/wallet?studentId=${studentId}`,
    ],
  },

  reviews: {
    /** GET → ReviewResponseDTO[] (status = PENDING) */
    pending: '/api/admin/reviews/pending',
    /** PUT /api/admin/reviews/{id}/approve */
    approve: (id: number) => `/api/admin/reviews/${id}/approve`,
    /** PUT /api/admin/reviews/{id}/reject — body { adminRemark } */
    reject: (id: number) => `/api/admin/reviews/${id}/reject`,
    /** PUT /api/admin/reviews/{id}/verify-purchase */
    verifyPurchase: (id: number) => `/api/admin/reviews/${id}/verify-purchase`,
    /** POST multipart @ModelAttribute + images[]/videos[] — publishes immediately */
    external: '/api/admin/reviews/external',
  },

  chat: {
    /** GET ?orderId=&role= → ChatMessage[] */
    historyAll: '/api/order-chat/history/all',
    /** GET ?orderId=&role=&page=&size= → Page<ChatMessage> */
    history: '/api/order-chat/history',
    /** GET ?orderId=&keyword=&role=&page=&size= */
    search: '/api/order-chat/search',
    /** POST /api/order-chat/seen/{messageId} */
    seen: (messageId: number) => `/api/order-chat/seen/${messageId}`,
    /** GET ?orderId= → number */
    unreadCount: '/api/order-chat/unread-count',
    /** POST multipart — field name `file` → ChatUploadResponse */
    upload: '/api/order-chat/upload',
  },
} as const;

/** STOMP destinations. Subscribe paths on the left, publish paths on the right. */
export const STOMP = {
  subscribe: {
    userQueue: '/user/queue/messages',
    presence: '/topic/presence',
    orderChat: (orderId: number) => `/topic/chat/${orderId}`,
    orderDelivered: (orderId: number) => `/topic/chat/${orderId}/delivered`,
    orderSeen: (orderId: number) => `/topic/chat/${orderId}/seen`,
    orderTyping: (orderId: number) => `/topic/chat/${orderId}/typing`,
  },
  publish: {
    send: '/app/chat.send',
    typing: '/app/chat.typing',
    seen: '/app/chat.seen',
  },
} as const;

/** Frontend routes (replaces the Thymeleaf @{...} link expressions). */
export const ROUTES = {
  home: '/',
  adminLogin: '/admin/login',
  adminDashboard: '/admin/dashboard',
  expertLogin: '/expert/login',
  expertDashboard: '/expert/dashboard',
} as const;
