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
  ThumbsUp,
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
import { ShoppingCartComponent } from "./shopping-cart"

interface Product {
  [key: string]: any
}

interface SessionItem {
  product: string
  "product name": string
  description: string
  engagement: "click" | "hover" | "share"
  "dwell time": number
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
  popularity: number
  net_feedback: number
  recommendation_score: number
  reason: string
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

  // Pagination and filtering state
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    minPrice: 0,
    maxPrice: 2000, // Increased default max
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
  const [limit, setLimit] = useState(20) // Increased from 8 to 20
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
    Record<string, { name: string; description: string; popularity: number; feedback: number; image: string }>
  >({})

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([])

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

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  // Fetch products with filters and pagination
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
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log("📦 API Response:", {
          productsCount: data.products?.length,
          totalProducts: data.pagination?.totalProducts,
          currentPage: data.pagination?.currentPage,
          totalPages: data.pagination?.totalPages,
          categoriesCount: data.filters?.categories?.length,
          priceRange: data.filters?.priceRange,
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
        } else {
          handleChatFallback(message)
          return
        }
      } else {
        handleChatFallback(message)
      }
    } catch (error) {
      console.log("Chat API call failed, using fallback:", error)
      handleChatFallback(message)
    } finally {
      setIsChatLoading(false)
    }
  }

  // Fallback chat responses
  const handleChatFallback = (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase()
    let response = ""
    let foundRecommendations: RecommendedProduct[] = []

    // Search through actual products first
    const matchingProducts = products.filter((product) => {
      const productName = product.name.toLowerCase()
      const description = product.description.toLowerCase()
      const category = product.category.toLowerCase()

      return (
        productName.includes(lowerMessage) ||
        description.includes(lowerMessage) ||
        category.includes(lowerMessage) ||
        (lowerMessage.includes("harry potter") &&
          (productName.includes("harry") ||
            productName.includes("potter") ||
            description.includes("harry") ||
            description.includes("potter"))) ||
        (lowerMessage.includes("book") &&
          (category.includes("book") || description.includes("book") || productName.includes("book"))) ||
        (lowerMessage.includes("movie") &&
          (category.includes("movie") || description.includes("movie") || description.includes("film"))) ||
        (lowerMessage.includes("tech") &&
          (category.includes("tech") || description.includes("tech") || description.includes("electronic"))) ||
        (lowerMessage.includes("toy") &&
          (category.includes("toy") || description.includes("toy") || productName.includes("toy")))
      )
    })

    if (matchingProducts.length > 0) {
      foundRecommendations = matchingProducts.slice(0, 6).map((product, index) => ({
        id: `found-${product.id || index}`,
        name: product.name,
        description: product.description,
        category: product.category,
        image: product.image || `/placeholder.svg?height=300&width=300&query=${encodeURIComponent(product.name)}`,
        popularity: product.popularity || 0,
        net_feedback: product.net_feedback || 0,
        recommendation_score: 0.95,
        reason: `Found matching your search: "${userMessage}"`,
      }))

      response = `Great! I found ${matchingProducts.length} item${matchingProducts.length > 1 ? "s" : ""} matching "${userMessage}". ${foundRecommendations.length > 1 ? "Here are the top matches:" : "Here it is:"} Click on any item below to view details or scroll down to see all products.`
    } else {
      response = `I couldn't find any items specifically matching "${userMessage}" in our current inventory. Try using the filters on the left to browse by category, or search for broader terms like "books", "movies", "technology", or "toys".`
      foundRecommendations = []
    }

    const assistantMessage: ChatMessage = {
      id: generateUUID(),
      role: "assistant",
      content: response,
      timestamp: new Date(),
    }

    setChatMessages((prev) => [...prev, assistantMessage])
    setRecommendedProducts(foundRecommendations)
  }

  // Fetch recommendations from backend
  const fetchRecommendations = async (sessionId: string) => {
    if (!sessionId) return

    setRecommendationsLoading(true)
    try {
      const response = await fetch(`/api/recommend?session_id=${sessionId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const recommendations = await response.json()
        setRecommendedProducts(recommendations)
      } else {
        console.log("API endpoint not available, using mock recommendations")
        generateMockRecommendations()
      }
    } catch (error) {
      console.log("API call failed, using mock recommendations:", error)
      generateMockRecommendations()
    } finally {
      setRecommendationsLoading(false)
    }
  }

  // Generate mock recommendations based on user interactions
  const generateMockRecommendations = () => {
    const mockRecommendations: RecommendedProduct[] = [
      {
        id: "rec-1",
        name: "The Great Gatsby",
        description: "A classic American novel about the Jazz Age and the American Dream",
        category: "Books",
        image: "/placeholder.svg?height=300&width=300",
        popularity: 850,
        net_feedback: 420,
        recommendation_score: 0.92,
        reason: "Based on your interest in classic literature",
      },
      {
        id: "rec-2",
        name: "Inception Blu-ray",
        description: "Mind-bending sci-fi thriller about dreams within dreams",
        category: "Movies",
        image: "/placeholder.svg?height=300&width=300",
        popularity: 1200,
        net_feedback: 890,
        recommendation_score: 0.88,
        reason: "Customers who viewed similar items also liked this",
      },
      {
        id: "rec-3",
        name: "Wireless Earbuds Pro",
        description: "Premium noise-cancelling wireless earbuds with long battery life",
        category: "Technology",
        image: "/placeholder.svg?height=300&width=300",
        popularity: 650,
        net_feedback: 380,
        recommendation_score: 0.85,
        reason: "Trending in your browsing category",
      },
    ]

    setRecommendedProducts(mockRecommendations.slice(0, 4))
  }

  // Fetch recommendations when session has interactions
  useEffect(() => {
    if (sessionData.itemlist.length > 0) {
      const timeoutId = setTimeout(() => {
        fetchRecommendations(sessionData.session_id)
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [sessionData.itemlist.length, sessionData.session_id])

  const trackEngagement = (
    productId: string,
    productName: string,
    description: string,
    engagement: "click" | "hover" | "share",
    dwellTime = 0,
    addedToCart: 0 | 1 = 0,
    popularity: number,
    feedback: number,
    image: string,
  ) => {
    const sessionItem: SessionItem = {
      product: productId,
      "product name": productName,
      description: description,
      engagement: engagement,
      "dwell time": Math.round((dwellTime / 1000) * 100) / 100,
      added_to_cart: addedToCart,
      "product popularity": popularity,
      net_feedback: feedback,
      image: image,
      event_sequence_number: sequenceNumber,
    }

    setSessionData((prev) => ({
      ...prev,
      itemlist: [...prev.itemlist, sessionItem],
    }))

    setSequenceNumber((prev) => prev + 1)
  }

  const handleMouseEnter = (
    productId: string,
    productName: string,
    description: string,
    popularity: number,
    feedback: number,
    image: string,
  ) => {
    const now = Date.now()
    hoverStartTimes.current[productId] = now

    productDataCache.current[productId] = {
      name: productName,
      description: description,
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
        "hover",
        dwellTime,
        0,
        cachedData.popularity,
        cachedData.feedback,
        cachedData.image,
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
      "click",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
    )

    // Find similar products (same category, different product)
    const similar = products
      .filter((p) => p.id !== product.id && p.categories?.some((cat: string) => product.categories?.includes(cat)))
      .slice(0, 6)

    setSimilarProducts(similar)
    setSelectedProduct(product)
    setIsProductDetailOpen(true)
  }

  const handleLike = (product: Product) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      "click",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
    )
    console.log(`Liked ${product.name}`)
    // You can add wishlist functionality here
  }

  const handleShare = (product: Product) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      "share",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
    )
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out this product: ${product.name}`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(`${product.name} - ${window.location.href}`)
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
      "click",
      0,
      1,
      product.popularity,
      product.net_feedback,
      product.image,
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

  const handleRecommendedClick = (product: RecommendedProduct) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      "click",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
    )

    const productElement = document.querySelector(`[data-product-name="${product.name}"]`)
    if (productElement) {
      productElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      productElement.classList.add("ring-2", "ring-primary", "ring-offset-2")
      setTimeout(() => {
        productElement.classList.remove("ring-2", "ring-primary", "ring-offset-2")
      }, 3000)
    }

    console.log(`Clicked on recommended product: ${product.name}`)
  }

  const handleRecommendedShare = (product: RecommendedProduct) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      "share",
      0,
      0,
      product.popularity,
      product.net_feedback,
      product.image,
    )
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out this recommended product: ${product.name}`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(`${product.name} - ${window.location.href}`)
      alert("Product link copied to clipboard!")
    }
  }

  const handleRecommendedAddToCart = (product: RecommendedProduct) => {
    trackEngagement(
      product.id,
      product.name,
      product.description,
      "click",
      0,
      1,
      product.popularity,
      product.net_feedback,
      product.image,
    )
    console.log(`Added recommended product to cart: ${product.name}`)
    alert(`${product.name} added to cart!`)
  }

  const handleAddToCartQuantityChange = (change: number) => {
    if (addToCartProduct) {
      const newQuantity = Math.max(1, Math.min(addToCartProduct.stock || 99, addToCartQuantity + change))
      setAddToCartQuantity(newQuantity)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl">
        {/* Header with Cart */}
        <div className="flex items-center justify-between mb-8 sm:mb-16">
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent mb-4">
              Product Showcase
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
              Discover our curated collection of premium products
            </p>
            <div className="w-20 h-0.5 bg-gradient-to-r from-primary/50 to-primary mx-auto mt-6 rounded-full"></div>
          </div>

          <div className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0">
            <ShoppingCartComponent
              cartItems={cartItems}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemoveItem={handleRemoveFromCart}
              onClearCart={handleClearCart}
            />
          </div>
        </div>

        {/* Session Tracking Controls */}
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
              onClick={() => fetchRecommendations(sessionData.session_id)}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {recommendedProducts.map((product) => (
                <div
                  key={product.id}
                  className="group bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden"
                  onMouseEnter={() =>
                    handleMouseEnter(
                      product.id,
                      product.name,
                      product.description,
                      product.popularity,
                      product.net_feedback,
                      product.image,
                    )
                  }
                  onMouseLeave={() => handleMouseLeave(product.id)}
                >
                  <div className="absolute top-1 right-1 z-10">
                    <Badge className="bg-primary text-white text-xs px-1.5 py-0.5">
                      {Math.round(product.recommendation_score * 100)}%
                    </Badge>
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
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-slate-700">{product.popularity}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ThumbsUp className="h-3 w-3 text-green-600" />
                        <span className="font-medium text-slate-700">{product.net_feedback}</span>
                      </div>
                    </div>

                    <p className="text-xs text-primary font-medium italic line-clamp-1">{product.reason}</p>

                    <div className="flex gap-1 pt-1">
                      <Button
                        onClick={() => handleRecommendedClick(product)}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs px-1 py-1 h-6 hover:bg-slate-50 flex items-center justify-center"
                      >
                        <Heart className="h-2.5 w-2.5 mr-0.5" />
                        <span className="hidden sm:inline">Like</span>
                      </Button>
                      <Button
                        onClick={() => handleRecommendedShare(product)}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs px-1 py-1 h-6 hover:bg-slate-50 flex items-center justify-center"
                      >
                        <Share2 className="h-2.5 w-2.5 mr-0.5" />
                        <span className="hidden sm:inline">Share</span>
                      </Button>
                      <Button
                        onClick={() => handleRecommendedAddToCart(product)}
                        size="sm"
                        className="flex-1 text-xs px-1 py-1 h-6 bg-primary hover:bg-primary/90 flex items-center justify-center"
                      >
                        <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
                        <span className="hidden sm:inline">Cart</span>
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
            {/* Debug Info - Remove after testing */}
            {process.env.NODE_ENV === "development" && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-sm mb-2">Debug Info:</h3>
                <div className="text-xs space-y-1">
                  <div>Products loaded: {products.length}</div>
                  <div>Total products: {pagination.totalProducts}</div>
                  <div>
                    Current page: {pagination.currentPage} of {pagination.totalPages}
                  </div>
                  <div>Categories: {categories.length}</div>
                  <div>
                    Price range: ${priceRange.min} - ${priceRange.max}
                  </div>
                  <div>Filters initialized: {filtersInitialized ? "Yes" : "No"}</div>
                  <div>
                    Active filters: Category={filters.category}, Search="{filters.search}", Price=${filters.minPrice}-$
                    {filters.maxPrice}
                  </div>
                </div>
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
            {productsLoading && products.length === 0 ? (
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
                            onClick={() => handleLike(product)}
                            variant="outline"
                            size="sm"
                            className="flex items-center justify-center bg-transparent"
                          >
                            <Heart className="h-3 w-3" />
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
    </div>
  )
}
