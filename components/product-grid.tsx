"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProductFilters } from "./product-filters"
import { ProductPagination } from "./product-pagination"
import {
  Heart,
  Share2,
  ShoppingCart,
  Star,
  Download,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  SlidersHorizontal,
  Minus,
  Plus,
} from "lucide-react"
import { ProductDetailModal } from "./product-detail-modal"

interface Product {
  [key: string]: any
}

interface SessionItem {
  product: string
  "product name": string
  description: string
  category: string
  "about product": string
  engagement: "click" | "hover" | "share"
  "dwell time": number
  wishlisted: 0 | 1
  added_to_cart: 0 | 1
  "product popularity": number
  net_feedback: number
  image: string
  event_sequence_number: number
}

interface SessionData {
  session_id: string
  itemlist: SessionItem[]
}

interface RecommendedProduct {
  id: string
  name: string
  description: string
  category: string
  image: string
  price: number
  rank: number
  similarity_score: number
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface FilterState {
  category: string
  minPrice: number
  maxPrice: number
  search: string
  sortBy: "name" | "popularity" | "price" | "feedback"
  sortOrder: "asc" | "desc"
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalProducts: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
  stock?: number
}

export function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSessionPreview, setShowSessionPreview] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [filtersInitialized, setFiltersInitialized] = useState(false)

  // Liked products state
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set())
  const [showWishlist, setShowWishlist] = useState(false)

  // Pagination and filtering state
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    minPrice: 0,
    maxPrice: 2000,
    search: "",
    sortBy: "popularity",
    sortOrder: "desc",
  })
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })
  const [limit, setLimit] = useState(20)
  const [categories, setCategories] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState({ min: 0, max: 2000 })

  // Infinite scroll state
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(false)
  const [hasMoreProducts, setHasMoreProducts] = useState(true)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const [sessionData, setSessionData] = useState<SessionData>({
    session_id: "",
    itemlist: [],
  })
  const [sequenceNumber, setSequenceNumber] = useState(1)

  // Chatbot state
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  const hoverStartTimes = useRef<Record<string, number>>({})
  const productDataCache = useRef<
    Record<
      string,
      {
        name: string
        description: string
        category: string
        aboutProduct: string
        popularity: number
        feedback: number
        image: string
      }
    >
  >({})

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false)
  const [similarProducts, setSimilarProducts] = useState<Product[]>([])

  // Add to cart modal state
  const [addToCartProduct, setAddToCartProduct] = useState<Product | null>(null)
  const [isAddToCartOpen, setIsAddToCartOpen] = useState(false)
  const [addToCartQuantity, setAddToCartQuantity] = useState(1)

  // Generate UUID
  const generateUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c == "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  // Initialize session and welcome message
  useEffect(() => {
    const sessionId = generateUUID()
    setSessionData({
      session_id: sessionId,
      itemlist: [],
    })

    connectToWebservice(sessionId)

    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: generateUUID(),
      role: "assistant",
      content:
        "Hi! I'm your shopping assistant. I can help you find products, answer questions about items, compare products, or provide recommendations. What would you like to explore today?",
      timestamp: new Date(),
    }
    setChatMessages([welcomeMessage])
  }, [])

  const connectToWebservice = async (sessionId: string) => {
    try {
      const webserviceUrl =
        "https://product-recommendation-ws-ese6bjcce8g8fafa.centralindia-01.azurewebsites.net/api/recommend"
      console.log("🌐 Connecting to webservice:", webserviceUrl)

      const response = await fetch(`${webserviceUrl}?session_id=${sessionId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        console.log("✅ Successfully connected to webservice")
      } else {
        console.log("⚠️ Webservice connection failed, will use fallback recommendations")
      }
    } catch (error) {
      console.log("❌ Error connecting to webservice:", error)
    }
  }

  const fetchRecommendationsFromBackend = async (sessionId: string) => {
    if (!sessionId) return

    setRecommendationsLoading(true)
    try {
      console.log("🔄 Fetching recommendations from Vercel API...")

      // Fetch recommendations from local Vercel API
      const response = await fetch("/api/recommendations", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        console.log("📦 Received recommendations from API:", data)

        if (data.recommendations && Array.isArray(data.recommendations)) {
          setRecommendedProducts(data.recommendations)
          console.log("✅ Using API recommendations:", data.recommendations.length)
        } else {
          console.log("⚠️ API returned invalid format, showing empty state")
          setRecommendedProducts([])
        }
      } else {
        console.log("⚠️ API request failed, showing empty state")
        setRecommendedProducts([])
      }
    } catch (error) {
      console.log("❌ API error, showing empty state:", error)
      setRecommendedProducts([])
    } finally {
      setRecommendationsLoading(false)
    }
  }

  useEffect(() => {
    if (sessionData.itemlist.length > 0 && products.length > 0) {
      const timeoutId = setTimeout(() => {
        // Send updated session data to webservice and fetch new recommendations
        fetchRecommendationsFromBackend(sessionData.session_id)
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [sessionData.itemlist.length, sessionData.session_id, products.length])

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  // Fetch products with filters and pagination - Updated to use new API
  const fetchProducts = useCallback(
    async (resetPagination = false) => {
      if (resetPagination) {
        setProductsLoading(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const params = new URLSearchParams({
          category: filters.category,
          minPrice: filters.minPrice.toString(),
          maxPrice: filters.maxPrice.toString(),
          search: filters.search,
          page: resetPagination ? "1" : pagination.currentPage.toString(),
          limit: limit.toString(),
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        })

        console.log("🔄 Fetching products with params:", Object.fromEntries(params))

        const response = await fetch(`/api/products?${params}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log("📦 API Response:", {
          productsCount: data.products?.length,
          totalProducts: data.pagination?.totalProducts,
          currentPage: data.pagination?.currentPage,
          totalPages: data.pagination?.totalPages,
          categoriesCount: data.filters?.categories?.length,
          priceRange: data.filters?.priceRange,
          dataSource: data.dataSource,
        })

        if (infiniteScrollEnabled && !resetPagination && pagination.currentPage > 1) {
          // Append products for infinite scroll
          setProducts((prev) => [...prev, ...data.products])
        } else {
          // Replace products for pagination or initial load
          setProducts(data.products)
        }

        setPagination(data.pagination)
        setCategories(data.filters.categories)

        // Always update price range from API
        const newPriceRange = data.filters.priceRange
        setPriceRange(newPriceRange)
        setHasMoreProducts(data.pagination.hasNextPage)

        // Initialize filters with actual price range only on first load
        if (!filtersInitialized) {
          setFilters((prev) => ({
            ...prev,
            minPrice: newPriceRange.min,
            maxPrice: newPriceRange.max,
          }))
          setFiltersInitialized(true)
        }
      } catch (err) {
        console.error("❌ Fetch error:", err)
        setError(`Failed to load products: ${err}`)
      } finally {
        setLoading(false)
        setProductsLoading(false)
      }
    },
    [filters, pagination.currentPage, limit, infiniteScrollEnabled, filtersInitialized],
  )

  // Load more products for infinite scroll
  const loadMoreProducts = useCallback(async () => {
    if (!hasMoreProducts || productsLoading) return

    setProductsLoading(true)
    try {
      const params = new URLSearchParams({
        category: filters.category,
        minPrice: filters.minPrice.toString(),
        maxPrice: filters.maxPrice.toString(),
        search: filters.search,
        page: (pagination.currentPage + 1).toString(),
        limit: limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      })

      const response = await fetch(`/api/products?${params}`)
      const data = await response.json()

      setProducts((prev) => [...prev, ...data.products])
      setPagination(data.pagination)
      setHasMoreProducts(data.pagination.hasNextPage)
    } catch (err) {
      console.error("Error loading more products:", err)
    } finally {
      setProductsLoading(false)
    }
  }, [filters, pagination.currentPage, limit, hasMoreProducts, productsLoading])

  // Infinite scroll observer
  useEffect(() => {
    if (!infiniteScrollEnabled) return

    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreProducts && !productsLoading) {
          loadMoreProducts()
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [infiniteScrollEnabled, hasMoreProducts, productsLoading, loadMoreProducts])

  // Fetch products when filters change (but only after initialization)
  useEffect(() => {
    if (!filtersInitialized) return

    const timeoutId = setTimeout(() => {
      fetchProducts(true)
    }, 300) // Debounce API calls

    return () => clearTimeout(timeoutId)
  }, [filters, limit, filtersInitialized])

  // Initial load
  useEffect(() => {
    fetchProducts(true)
  }, [])

  // Handle filter changes
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setPagination((prev) => ({ ...prev, currentPage: 1 }))
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, currentPage: page }))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPagination((prev) => ({ ...prev, currentPage: 1 }))
  }

  // Send chat message and get AI response
  const sendChatMessage = async (message: string) => {
    if (!message.trim()) return

    const userMessage: ChatMessage = {
      id: generateUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    }

    setChatMessages((prev) => [...prev, userMessage])
    setChatInput("")
    setIsChatLoading(true)
    handleChatSubmit(message)
  }

  const handleChatSubmit = async (message: string) => {
    if (!message.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      id: generateUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    }

    setChatMessages((prev) => [...prev, userMessage])
    setIsChatLoading(true)

    try {
      const response = await fetch("/api/chat_recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          session_id: sessionData.session_id,
          session_data: sessionData,
          chat_history: chatMessages,
          available_products: products,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        const assistantMessage: ChatMessage = {
          id: generateUUID(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        }

        setChatMessages((prev) => [...prev, assistantMessage])

        if (data.recommendations && data.recommendations.length > 0) {
          setRecommendedProducts(data.recommendations)
        }
      } else {
        console.log("Chat API call failed")
      }
    } catch (error) {
      console.log("Chat API call failed:", error)
    } finally {
      setIsChatLoading(false)
    }
  }

  // Fetch recommendations from backend

  // Fetch recommendations when session has interactions
  useEffect(() => {
    if (sessionData.itemlist.length > 0 && products.length > 0) {
      const timeoutId = setTimeout(() => {
        // Send updated session data to webservice and fetch new recommendations
        fetchRecommendationsFromBackend(sessionData.session_id)
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [sessionData.itemlist.length, sessionData.session_id, products.length])

  const trackEngagement = (
    productId: string,
    productName: string,
    description: string,
    category: string,
    aboutProduct: string,
    engagement: "click" | "hover" | "share",
    dwellTime = 0,
    addedToCart: 0 | 1 = 0,
    popularity: number,
    feedback: number,
    image: string,
    wishlisted: 0 | 1 = 0,
  ) => {
    const sessionItem: SessionItem = {
      product: productId,
      "product name": productName,
      description: description,
      category: category,
      "about product": aboutProduct,
      engagement: engagement,
      "dwell time": Math.round((dwellTime / 1000) * 100) / 100,
      wishlisted: wishlisted,
      added_to_cart: addedToCart,
      "product popularity": popularity,
      net_feedback: feedback,
      image: image,
      event_sequence_number: sequenceNumber,
    }

    const updatedSessionData = {
      ...sessionData,
      itemlist: [...sessionData.itemlist, sessionItem],
    }

    setSessionData(updatedSessionData)
    setSequenceNumber((prev) => prev + 1)

    fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedSessionData),
    }).catch((error) => {
      console.error("Failed to update session data:", error)
    })
  }

  const handleMouseEnter = (
    productId: string,
    productName: string,
    description: string,
    category: string,
    aboutProduct: string,
    popularity: number,
    feedback: number,
    image: string,
  ) => {
    const now = Date.now()
    hoverStartTimes.current[productId] = now

    productDataCache.current[productId] = {
      name: productName,
      description: description,
      category: category,
      aboutProduct: aboutProduct,
      popularity: popularity,
      feedback: feedback,
      image: image,
    }
  }

  const handleMouseLeave = (productId: string) => {
    const startTime = hoverStartTimes.current[productId]
    const cachedData = productDataCache.current[productId]

    if (startTime && cachedData) {
      const dwellTime = Date.now() - startTime
      trackEngagement(
        productId,
        cachedData.name,
        cachedData.description,
        cachedData.category,
        cachedData.aboutProduct,
        "hover",
        dwellTime,
        0,
        cachedData.popularity,
        cachedData.feedback,
        cachedData.image,
        0,
      )
      delete hoverStartTimes.current[productId]
      delete productDataCache.current[productId]
    }
  }

  const downloadSession = () => {
    const dataStr = JSON.stringify(sessionData, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)

    const exportFileDefaultName = `session_${sessionData.session_id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  const handleViewDetails = (product: Product) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      product.category || "General",
      product.about_product || product.description || "No additional product information available",
      "click",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
      0,
    )

    // Find similar products (same category, different product)
    const similar = products
      .filter((p) => p.id !== product.id && p.categories?.some((cat: string) => product.categories?.includes(cat)))
      .slice(0, 6)

    setSimilarProducts(similar)
    setSelectedProduct(product)
    setIsProductDetailOpen(true)
  }

  const handleShare = (product: Product | RecommendedProduct) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      product.category || "General",
      product.about_product || product.description || "No additional product information available",
      "share",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
      0,
    )

    const shareUrl = `${window.location.origin}${window.location.pathname}?product=${encodeURIComponent(product.name)}`
    const shareText = `Check out this product: ${product.name} - ${product.description}`

    if (navigator.share) {
      navigator
        .share({
          title: product.name,
          text: shareText,
          url: shareUrl,
        })
        .catch((error) => {
          console.log("Error sharing:", error)
          // Fallback to clipboard
          navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
          alert("Product link copied to clipboard!")
        })
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      alert("Product link copied to clipboard!")
    }
  }

  const handleAddToCartClick = (product: Product) => {
    setAddToCartProduct(product)
    setAddToCartQuantity(1)
    setIsAddToCartOpen(true)
  }

  const handleAddToCartConfirm = () => {
    if (addToCartProduct) {
      handleAddToCart(addToCartProduct, addToCartQuantity)
      setIsAddToCartOpen(false)
      setAddToCartProduct(null)
    }
  }

  const handleAddToCart = (product: Product, quantity: number) => {
    setCartItems((prev) => {
      const existingItem = prev.find((item) => item.id === product.id)
      if (existingItem) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item))
      } else {
        return [
          ...prev,
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity,
            image: product.image,
            stock: product.stock,
          },
        ]
      }
    })

    trackEngagement(
      product.id,
      product.name,
      product.description,
      product.category || "General",
      product.about_product || product.description || "No additional product information available",
      "click",
      0,
      1,
      product.popularity,
      product.net_feedback,
      product.image,
      0,
    )

    console.log(`Added ${quantity}x ${product.name} to cart`)
  }

  const handleUpdateCartQuantity = (id: string, quantity: number) => {
    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)))
  }

  const handleRemoveFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleClearCart = () => {
    setCartItems([])
  }

  const handleProductDetailClick = (product: Product) => {
    const similar = products
      .filter((p) => p.id !== product.id && p.categories?.some((cat: string) => product.categories?.includes(cat)))
      .slice(0, 6)

    setSimilarProducts(similar)
    setSelectedProduct(product)
    setIsProductDetailOpen(true)
  }

  const handleRecommendedViewDetails = (product: RecommendedProduct) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      product.category || "General",
      product.about_product || product.description || "No additional product information available",
      "click",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
      0,
    )

    // Convert RecommendedProduct to Product format for the modal
    const productForModal = {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      categories: [product.category],
      image: product.image,
      popularity: product.popularity,
      net_feedback: product.net_feedback,
      price: Math.floor(Math.random() * 100) + 10, // Mock price
      rating: (4 + Math.random()).toFixed(1), // Mock rating
      stock: Math.floor(Math.random() * 50) + 10, // Mock stock
    }

    // Find similar products from the main products list
    const similar = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 6)

    setSimilarProducts(similar)
    setSelectedProduct(productForModal)
    setIsProductDetailOpen(true)
  }

  const handleRecommendedAddToCart = (product: RecommendedProduct) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      product.category || "General",
      product.about_product || product.description || "No additional product information available",
      "click",
      0,
      1,
      product.popularity,
      product.net_feedback,
      product.image,
      0,
    )

    // Add recommended product to cart with mock price
    const cartItem: CartItem = {
      id: product.id,
      name: product.name,
      price: Math.floor(Math.random() * 100) + 10, // Mock price
      quantity: 1,
      image: product.image,
      stock: Math.floor(Math.random() * 50) + 10, // Mock stock
    }

    setCartItems((prev) => {
      const existingItem = prev.find((item) => item.id === product.id)
      if (existingItem) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      } else {
        return [...prev, cartItem]
      }
    })

    console.log(`Added recommended product to cart: ${product.name}`)
    alert(`${product.name} added to cart!`)
  }

  const handleAddToCartQuantityChange = (change: number) => {
    if (addToCartProduct) {
      const newQuantity = Math.max(1, Math.min(addToCartProduct.stock || 99, addToCartQuantity + change))
      setAddToCartQuantity(newQuantity)
    }
  }

  const handleWishlistToggle = (product: Product) => {
    const newWishlistItems = new Set(wishlistItems)
    if (newWishlistItems.has(product.id)) {
      newWishlistItems.delete(product.id)
    } else {
      newWishlistItems.add(product.id)
    }
    setWishlistItems(newWishlistItems)

    const isWishlisted = newWishlistItems.has(product.id) ? 1 : 0

    // Track wishlist action in session
    trackEngagement(
      product.id,
      product.name,
      product.description,
      product.category || "General",
      product.about_product || product.description || "No additional product information available",
      "click",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
      isWishlisted,
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl">
        {/* Header with Cart */}
        {/* Header with Cart and Session Controls */}
        <div className="flex items-start justify-between mb-8 sm:mb-12">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-left mb-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Product Showcase
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground text-left max-w-lg">
              Discover our curated collection of premium products for kids
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-4">
            <Button
              onClick={() => setShowWishlist(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-white hover:bg-red-50 border-red-200 text-red-600"
            >
              <Heart className="h-4 w-4" />
              <span>Wishlist ({wishlistItems.size})</span>
            </Button>

            {/* Session Tracking Controls */}
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-mono text-xs">
                  Session: {sessionData.session_id.slice(0, 8)}...
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {sessionData.itemlist.length} interactions
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  onClick={() => setShowSessionPreview(!showSessionPreview)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-xs px-2 py-1 h-7"
                >
                  {showSessionPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span className="hidden sm:inline">{showSessionPreview ? "Hide" : "Show"}</span>
                </Button>
                <Button
                  onClick={downloadSession}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-xs px-2 py-1 h-7 bg-transparent"
                  disabled={sessionData.itemlist.length === 0}
                >
                  <Download className="h-3 w-3" />
                  <span className="hidden sm:inline">JSON</span>
                </Button>
              </div>
            </div>

            {/* Cart Button */}
            <Button
              onClick={() => setIsCartOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-white hover:bg-primary/5 relative"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Cart ({cartItems.reduce((sum, item) => sum + item.quantity, 0)})</span>
              {cartItems.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Session Tracking Controls */}
        {/*
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row gap-4 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-mono text-xs">
              Session: {sessionData.session_id.slice(0, 8)}...
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {sessionData.itemlist.length} interactions tracked
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowSessionPreview(!showSessionPreview)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {showSessionPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showSessionPreview ? "Hide" : "Show"} Session
            </Button>
            <Button
              onClick={downloadSession}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-transparent"
              disabled={sessionData.itemlist.length === 0}
            >
              <Download className="h-4 w-4" />
              Download JSON
            </Button>
          </div>
        </div>
        */}

        {/* Live Session Preview */}
        {showSessionPreview && (
          <div className="mb-6 sm:mb-8 bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-96">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400">Live Session Data:</span>
              <Badge className="bg-green-400/20 text-green-400 text-xs">Live</Badge>
            </div>
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(sessionData, null, 2)}</pre>
          </div>
        )}

        {/* Recommended Products Section */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Recommended for You</h2>
              <Badge className="bg-primary/10 text-primary text-xs">AI-powered</Badge>
            </div>
            <Button
              onClick={() => fetchRecommendationsFromBackend(sessionData.session_id)}
              variant="outline"
              size="sm"
              disabled={recommendationsLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${recommendationsLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          {recommendedProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Updated recommendation display to use new data structure */}
              {recommendedProducts.map((product) => (
                <div
                  key={product.id}
                  className="group bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden"
                  onMouseEnter={() =>
                    handleMouseEnter(
                      product.id,
                      product.name,
                      product.description,
                      product.category || "General",
                      product.description || "No additional product information available",
                      product.rank,
                      Math.round(product.similarity_score * 100),
                      product.image,
                    )
                  }
                  onMouseLeave={() => handleMouseLeave(product.id)}
                >
                  <div className="absolute top-1 right-1 z-10">
                    <Badge className="bg-primary text-white text-xs px-1.5 py-0.5">#{product.rank}</Badge>
                  </div>

                  <div className="aspect-square overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 rounded-t-lg">
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-2 sm:p-3 space-y-2">
                    <h3 className="font-medium text-xs sm:text-sm text-slate-900 line-clamp-2 leading-tight">
                      {product.name}
                    </h3>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1">
                        <span className="font-medium text-slate-700">${product.price}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="font-medium text-slate-700">
                          {Math.round(product.similarity_score * 100)}% match
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 pt-1">
                      <Button
                        onClick={() => handleShare(product)}
                        variant="outline"
                        size="sm"
                        className="text-xs px-1 py-1 h-6 hover:bg-slate-50 flex items-center justify-center"
                        title="Share"
                      >
                        <Share2 className="h-2.5 w-2.5 text-slate-600" />
                      </Button>
                      <Button
                        onClick={() => handleRecommendedViewDetails(product)}
                        variant="outline"
                        size="sm"
                        className="text-xs px-1 py-1 h-6 hover:bg-slate-50 flex items-center justify-center"
                        title="View Details"
                      >
                        <Eye className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        onClick={() => handleRecommendedAddToCart(product)}
                        size="sm"
                        className="text-xs px-1 py-1 h-6 bg-primary hover:bg-primary/90 flex items-center justify-center"
                        title="Add to Cart"
                      >
                        <ShoppingCart className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-slate-400 mb-2">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
              </div>
              <p className="text-slate-500 text-sm">
                Start chatting with our AI assistant to get personalized recommendations!
              </p>
            </div>
          )}
        </div>

        {/* Main Content with Filters and Products */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <ProductFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              categories={categories}
              priceRange={priceRange}
              isLoading={productsLoading}
            />
          </div>

          {/* Mobile Filters */}
          <div className="lg:hidden">
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 mb-4 bg-transparent">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {(filters.category !== "all" ||
                    filters.search ||
                    filters.minPrice !== priceRange.min ||
                    filters.maxPrice !== priceRange.max) && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      Active
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <ProductFilters
                    filters={filters}
                    onFiltersChange={(newFilters) => {
                      handleFiltersChange(newFilters)
                      setMobileFiltersOpen(false)
                    }}
                    categories={categories}
                    priceRange={priceRange}
                    isLoading={productsLoading}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Products Section */}
          <div className="flex-1 min-w-0">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-semibold text-sm mb-2 text-red-800">Error Loading Products:</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Products Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">All Products</h2>
                <p className="text-sm text-muted-foreground mt-1">{pagination.totalProducts} products found</p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={infiniteScrollEnabled ? "outline" : "default"}
                  size="sm"
                  onClick={() => {
                    setInfiniteScrollEnabled(false)
                    fetchProducts(true)
                  }}
                  className="text-xs"
                >
                  Pagination
                </Button>
                <Button
                  variant={infiniteScrollEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setInfiniteScrollEnabled(true)
                    fetchProducts(true)
                  }}
                  className="text-xs"
                >
                  Infinite Scroll
                </Button>
              </div>
            </div>

            {/* Products Grid */}
            {loading && products.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">Loading products...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                  {products.map((product) => (
                    <Card
                      key={product.id}
                      className="group hover:shadow-xl transition-all duration-300 overflow-hidden bg-white border-0 shadow-md"
                      data-product-name={product.name}
                      onMouseEnter={() =>
                        handleMouseEnter(
                          product.id,
                          product.name,
                          product.description,
                          product.category || "General",
                          product.about_product || product.description || "No additional product information available",
                          product.popularity,
                          product.net_feedback,
                          product.image,
                        )
                      }
                      onMouseLeave={() => handleMouseLeave(product.id)}
                    >
                      <CardHeader className="p-0">
                        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                          <img
                            src={product.image || "/placeholder.svg"}
                            alt={product.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = `/placeholder.svg?height=300&width=300&query=${encodeURIComponent(product.name)}`
                            }}
                          />
                          {product.stock <= 10 && (
                            <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs">
                              Only {product.stock} left
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="p-3 sm:p-4 space-y-3">
                        <div>
                          <h3 className="font-semibold text-base sm:text-lg text-slate-900 line-clamp-2 leading-tight">
                            {product.name}
                          </h3>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-lg sm:text-xl font-bold text-primary">${product.price}</span>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{product.rating}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium px-3 py-1.5">
                            {product.category}
                          </Badge>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-4 gap-2">
                          <Button
                            onClick={() => handleViewDetails(product)}
                            className="col-span-2 bg-primary hover:bg-primary/90 text-xs"
                            size="sm"
                          >
                            View Details
                          </Button>
                          <Button
                            onClick={() => handleWishlistToggle(product)}
                            variant="outline"
                            size="sm"
                            className={`flex items-center justify-center bg-transparent ${
                              wishlistItems.has(product.id) ? "bg-red-50 border-red-200" : ""
                            }`}
                          >
                            <Heart
                              className={`h-3 w-3 ${
                                wishlistItems.has(product.id) ? "fill-red-500 text-red-500" : "text-slate-600"
                              }`}
                            />
                          </Button>
                          <Button
                            onClick={() => handleShare(product)}
                            variant="outline"
                            size="sm"
                            className="flex items-center justify-center bg-transparent"
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <Button
                          onClick={() => handleAddToCartClick(product)}
                          variant="outline"
                          className="w-full flex items-center gap-2 bg-transparent"
                          size="sm"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Add to Cart
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Infinite Scroll Loading Indicator */}
                {infiniteScrollEnabled && (
                  <div ref={loadMoreRef} className="flex justify-center py-8">
                    {productsLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Loading more products...</span>
                      </div>
                    ) : hasMoreProducts ? (
                      <Button
                        onClick={loadMoreProducts}
                        variant="outline"
                        className="flex items-center gap-2 bg-transparent"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Load More Products
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">No more products to load</p>
                    )}
                  </div>
                )}

                {/* Pagination */}
                {!infiniteScrollEnabled && (
                  <ProductPagination
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                    limit={limit}
                    isLoading={productsLoading}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add to Cart Modal */}
      <Dialog open={isAddToCartOpen} onOpenChange={setIsAddToCartOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Cart</DialogTitle>
          </DialogHeader>
          {addToCartProduct && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-md overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex-shrink-0">
                  <img
                    src={addToCartProduct.image || "/placeholder.svg"}
                    alt={addToCartProduct.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = `/placeholder.svg?height=80&width=80&query=${encodeURIComponent(addToCartProduct.name)}`
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg line-clamp-2">{addToCartProduct.name}</h3>
                  <p className="text-primary font-bold text-xl">${addToCartProduct.price}</p>
                  {addToCartProduct.stock <= 10 && (
                    <Badge variant="destructive" className="mt-1 text-xs">
                      Only {addToCartProduct.stock} left
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddToCartQuantityChange(-1)}
                    disabled={addToCartQuantity <= 1}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="font-medium text-lg w-8 text-center">{addToCartQuantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddToCartQuantityChange(1)}
                    disabled={addToCartQuantity >= (addToCartProduct.stock || 99)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsAddToCartOpen(false)} className="flex-1 bg-transparent">
                  Cancel
                </Button>
                <Button onClick={handleAddToCartConfirm} className="flex-1">
                  Add to Cart
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={isProductDetailOpen}
        onClose={() => setIsProductDetailOpen(false)}
        onAddToCart={handleAddToCart}
        similarProducts={similarProducts}
        onProductClick={handleProductDetailClick}
      />

      {/* AI Chatbot Panel */}
      <div className="fixed bottom-4 right-4 z-50">
        {!isChatOpen ? (
          <Button
            onClick={() => setIsChatOpen(true)}
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14 bg-primary hover:bg-primary/90 shadow-lg flex items-center justify-center"
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </Button>
        ) : (
          <Card className="w-80 sm:w-96 h-80 sm:h-96 bg-white shadow-xl border-0 flex flex-col">
            <CardHeader className="p-3 sm:p-4 border-b bg-primary text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                  <h3 className="font-semibold text-sm">Shopping Assistant</h3>
                </div>
                <Button
                  onClick={() => setIsChatOpen(false)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-primary/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-0">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] p-2 sm:p-3 rounded-lg text-sm ${
                        message.role === "user" ? "bg-primary text-white" : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {message.role === "assistant" && <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                        {message.role === "user" && <User className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                        <p className="leading-relaxed text-xs sm:text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-900 p-2 sm:p-3 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatMessagesEndRef} />
              </div>

              <div className="p-3 sm:p-4 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendChatMessage(chatInput)
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask me about products..."
                    className="flex-1 text-sm"
                    disabled={isChatLoading}
                  />
                  <Button type="submit" size="sm" disabled={!chatInput.trim() || isChatLoading} className="px-3">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showWishlist} onOpenChange={setShowWishlist}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              My Wishlist ({wishlistItems.size} items)
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            {wishlistItems.size === 0 ? (
              <div className="text-center py-8">
                <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Your wishlist is empty</p>
                <p className="text-sm text-gray-400">Click the heart icon on products to add them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products
                  .filter((product) => wishlistItems.has(product.id))
                  .map((product) => (
                    <Card key={product.id} className="group hover:shadow-lg transition-all duration-300">
                      <CardHeader className="p-0">
                        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                          <img
                            src={product.image || "/placeholder.svg"}
                            alt={product.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(product.name)}`
                            }}
                          />
                          <Button
                            onClick={() => handleWishlistToggle(product)}
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                          >
                            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-primary">${product.price}</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs">{product.rating}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              handleViewDetails(product)
                              setShowWishlist(false)
                            }}
                            size="sm"
                            className="flex-1 text-xs"
                          >
                            View Details
                          </Button>
                          <Button
                            onClick={() => {
                              handleAddToCartClick(product)
                              setShowWishlist(false)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                          >
                            Add to Cart
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
