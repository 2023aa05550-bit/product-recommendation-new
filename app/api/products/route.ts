import { type NextRequest, NextResponse } from "next/server"

interface Product {
  [key: string]: any
}

interface FilterParams {
  category?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  page?: number
  limit?: number
  sortBy?: "name" | "popularity" | "price" | "feedback"
  sortOrder?: "asc" | "desc"
}

// Cache for the fetched products
let cachedProducts: Product[] | null = null
let cacheTimestamp = 0
let lastErrorDetails: string | null = null
let lastSuccessfulSource: string | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// CSV parsing function
function parseCSV(csvText: string): Product[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row')
  }

  // Parse header - handle quoted headers and clean them
  const headerLine = lines[0]
  const headers = []
  let currentHeader = ''
  let inQuotes = false
  
  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      headers.push(currentHeader.trim().replace(/"/g, ''))
      currentHeader = ''
    } else {
      currentHeader += char
    }
  }
  headers.push(currentHeader.trim().replace(/"/g, ''))

  console.log(`📋 CSV Headers (${headers.length}):`, headers)

  // Parse data rows
  const products: Product[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines

    // Parse CSV line with proper quote handling
    const values = []
    let currentValue = ''
    let inQuotes = false
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim().replace(/^"|"$/g, ''))
        currentValue = ''
      } else {
        currentValue += char
      }
    }
    
    // Add the last value
    values.push(currentValue.trim().replace(/^"|"$/g, ''))

    // Create product object
    const product: Product = {}
    headers.forEach((header, index) => {
      const value = values[index] || ''
      product[header] = value
    })

    product.originalIndex = i - 1
    products.push(product)
  }

  console.log(`📦 Parsed ${products.length} products from CSV`)
  if (products.length > 0) {
    console.log(`📋 First product keys:`, Object.keys(products[0]))
    console.log(`📋 First product sample:`, JSON.stringify(products[0], null, 2).slice(0, 500))
  }
  
  return products
}

async function fetchProductsFromCSV(): Promise<Product[]> {
  // Check if we have cached data that's still fresh
  if (cachedProducts && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log(`📦 Using cached products: ${cachedProducts.length} items from ${lastSuccessfulSource}`)
    return cachedProducts
  }

  // Clear cache to force fresh fetch
  cachedProducts = null
  lastSuccessfulSource = null

  // Primary data source - Azure Blob Storage CSV
  const primaryUrl = "https://rohitproductstore.blob.core.windows.net/products/Final_dataset.csv?sp=r&st=2025-08-08T06:56:15Z&se=2025-10-31T15:11:15Z&spr=https&sv=2024-11-04&sr=b&sig=B9nsMsQMEpcNabzC%2BgMrBa5Y8%2FjJZJMDdKrglSQ3l%2FA%3D"

  console.log(`🎯 PRIORITY FETCH: Attempting to load CSV from Azure Blob Storage`)
  console.log(`🔗 URL: ${primaryUrl}`)

  try {
    const response = await fetch(primaryUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProductGrid/1.0)",
        Accept: "text/csv, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
    })

    console.log(`📡 Azure Blob Storage Response: ${response.status} ${response.statusText}`)
    console.log(`📄 Final URL: ${response.url}`)
    console.log(`📄 Content-Type: ${response.headers.get("content-type") || "unknown"}`)
    console.log(`📄 Content-Length: ${response.headers.get("content-length") || "unknown"}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Try to get response as text first
    let responseText: string
    try {
      responseText = await response.text()
      console.log(`📄 Response length: ${responseText.length} characters`)
      console.log(`📄 Response starts with: ${responseText.slice(0, 200)}...`)
    } catch (textError) {
      console.error(`❌ Failed to read response text:`, textError)
      throw new Error(`Failed to read response: ${textError}`)
    }

    // Validate it's not HTML
    if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
      console.log(`⚠️ Received HTML content instead of CSV`)
      throw new Error("Received HTML instead of CSV")
    }

    // Validate it's not empty
    if (!responseText.trim()) {
      throw new Error("Empty response received")
    }

    // Parse CSV
    let productsArray: Product[]
    try {
      productsArray = parseCSV(responseText)
      console.log(`✅ CSV parsed successfully`)
      console.log(`📊 Products array length: ${productsArray.length}`)
    } catch (parseError) {
      console.error(`❌ CSV parse error:`, parseError)
      console.log(`📄 Raw response that failed to parse: ${responseText.slice(0, 500)}`)
      throw new Error(`Invalid CSV: ${parseError}`)
    }

    if (productsArray.length === 0) {
      throw new Error("Empty products array")
    }

    // Process products with source tracking
    const processedProducts = productsArray.map((product, index) => ({
      ...product,
      id: product.id || product.Id || product.ID || `csv-product-${index}`,
      dataSource: "Azure Blob Storage CSV",
      fetchedAt: new Date().toISOString(),
    }))

    console.log(`🎉 SUCCESS: Loaded ${processedProducts.length} products from Azure Blob Storage CSV`)

    // Cache the results
    cachedProducts = processedProducts
    cacheTimestamp = Date.now()
    lastSuccessfulSource = "Azure Blob Storage CSV"
    lastErrorDetails = null

    return processedProducts
  } catch (error) {
    console.error(`❌ Azure Blob Storage CSV failed:`, error)

    // Try alternative JSON sources as fallback
    console.log(`🔄 Trying alternative JSON sources...`)

    const alternativeSources = [
      {
        url: "https://rohitproductstore.blob.core.windows.net/products/products_with_urls.json?sp=r&st=2025-08-08T06:42:32Z&se=2025-10-31T14:57:32Z&spr=https&sv=2024-11-04&sr=b&sig=bXKZ3%2FLGb8UjywoNtgPj%2BXfWGOFPQJ1BtYH4czu3afo%3D",
        name: "Azure Blob Storage JSON",
      },
      {
        url: "https://cdn.jsdelivr.net/gh/2023aa05550-bit/product-dataset@main/products_with_urls.json",
        name: "jsDelivr CDN",
      },
      {
        url: "https://raw.githubusercontent.com/2023aa05550-bit/product-dataset/main/products_with_urls.json",
        name: "GitHub Raw CDN",
      },
    ]

    for (const source of alternativeSources) {
      try {
        console.log(`🔄 Trying: ${source.name} - ${source.url}`)

        const response = await fetch(source.url, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ProductGrid/1.0)",
            Accept: "application/json, text/plain, */*",
          },
        })

        console.log(`📡 ${source.name} Response: ${response.status} ${response.statusText}`)

        if (!response.ok) {
          console.log(`❌ ${source.name} failed with status ${response.status}`)
          continue
        }

        const responseText = await response.text()
        console.log(`📄 ${source.name} response length: ${responseText.length}`)

        if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
          console.log(`⚠️ ${source.name} returned HTML`)
          continue
        }

        const data = JSON.parse(responseText)
        const productsArray = Array.isArray(data) ? data : [data]

        if (productsArray.length > 0) {
          const processedProducts = productsArray.map((product, index) => ({
            ...product,
            originalIndex: index,
            id: product.id || product.Id || `alt-product-${index}`,
            dataSource: source.name,
            fetchedAt: new Date().toISOString(),
          }))

          console.log(`✅ Alternative success: ${processedProducts.length} products from ${source.name}`)

          cachedProducts = processedProducts
          cacheTimestamp = Date.now()
          lastSuccessfulSource = source.name
          lastErrorDetails = null

          return processedProducts
        }
      } catch (altError) {
        console.log(`❌ ${source.name} failed:`, altError)
        continue
      }
    }

    // If all sources fail, use sample data
    console.log("🆘 All sources failed, using sample data")
    const sampleData = createSampleData()

    cachedProducts = sampleData
    cacheTimestamp = Date.now()
    lastSuccessfulSource = "Sample Data Fallback"
    lastErrorDetails = `All sources failed. Primary error: ${error}. Using sample data.`

    return sampleData
  }
}

function createSampleData(): Product[] {
  return [
    {
      id: "sample-1",
      name: "Wireless Bluetooth Headphones",
      description: "Premium noise-cancelling wireless headphones with 30-hour battery life and superior sound quality",
      category: "Electronics",
      price: 199.99,
      popularity: 1250,
      net_feedback: 890,
      originalIndex: 0,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-2",
      name: "The Great Gatsby - Classic Novel",
      description: "F. Scott Fitzgerald's timeless masterpiece about the Jazz Age and the American Dream",
      category: "Books",
      price: 12.99,
      popularity: 850,
      net_feedback: 620,
      originalIndex: 1,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-3",
      name: "Organic Coffee Beans - Premium Blend",
      description: "Single-origin organic coffee beans, medium roast, ethically sourced from Colombian highlands",
      category: "Food & Beverage",
      price: 24.99,
      popularity: 650,
      net_feedback: 480,
      originalIndex: 2,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-4",
      name: "Smart Fitness Watch",
      description: "Advanced fitness tracking with heart rate monitor, GPS, and 7-day battery life",
      category: "Electronics",
      price: 299.99,
      popularity: 980,
      net_feedback: 720,
      originalIndex: 3,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-5",
      name: "Yoga Mat - Eco-Friendly",
      description: "Non-slip yoga mat made from natural rubber, 6mm thick, perfect for all yoga styles",
      category: "Sports & Fitness",
      price: 49.99,
      popularity: 420,
      net_feedback: 350,
      originalIndex: 4,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-6",
      name: "Moisturizing Face Cream",
      description: "Anti-aging face cream with hyaluronic acid, vitamin C, and natural botanicals",
      category: "Beauty",
      price: 45.99,
      popularity: 380,
      net_feedback: 290,
      originalIndex: 5,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-7",
      name: "Stainless Steel Water Bottle",
      description: "Insulated water bottle keeps drinks cold for 24hrs, hot for 12hrs, BPA-free",
      category: "Home & Kitchen",
      price: 34.99,
      popularity: 720,
      net_feedback: 540,
      originalIndex: 6,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-8",
      name: "Wireless Gaming Mouse",
      description: "High-precision gaming mouse with RGB lighting, programmable buttons, and ergonomic design",
      category: "Electronics",
      price: 79.99,
      popularity: 1100,
      net_feedback: 780,
      originalIndex: 7,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-9",
      name: "Organic Green Tea",
      description: "Premium loose leaf green tea with antioxidants, sourced from Japanese tea gardens",
      category: "Food & Beverage",
      price: 18.99,
      popularity: 560,
      net_feedback: 420,
      originalIndex: 8,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "sample-10",
      name: "Bluetooth Speaker",
      description: "Portable waterproof speaker with 360-degree sound and 12-hour battery life",
      category: "Electronics",
      price: 89.99,
      popularity: 890,
      net_feedback: 650,
      originalIndex: 9,
      dataSource: "Sample Data",
      fetchedAt: new Date().toISOString(),
    },
  ]
}

// Helper functions to extract data from products
function getProductName(product: Product, index: number): string {
  // First, log what we're working with
  console.log(`🔍 Getting name for product ${index}:`, Object.keys(product))
  
  // Comprehensive list of possible name fields from CSV
  const nameFields = [
    // Standard name fields
    "name", "Name", "NAME",
    "title", "Title", "TITLE", 
    "product_name", "productName", "ProductName", "PRODUCT_NAME",
    "item_name", "itemName", "ItemName", "ITEM_NAME",
    "product_title", "productTitle", "ProductTitle", "PRODUCT_TITLE",
    "item_title", "itemTitle", "ItemTitle", "ITEM_TITLE",
    "display_name", "displayName", "DisplayName", "DISPLAY_NAME",
    "label", "Label", "LABEL",
    
    // Specific product type fields
    "book_title", "bookTitle", "BookTitle", "BOOK_TITLE",
    "movie_title", "movieTitle", "MovieTitle", "MOVIE_TITLE",
    "product", "Product", "PRODUCT",
    "item", "Item", "ITEM",
    
    // Common CSV variations
    "Product Name", "Product Title", "Item Name", "Item Title",
    "Book Title", "Movie Title", "Display Name",
    
    // Other possible variations
    "description", "Description", "DESCRIPTION" // Sometimes description contains the name
  ]

  for (const field of nameFields) {
    if (product[field] && typeof product[field] === "string" && product[field].trim()) {
      const name = product[field].trim()
      console.log(`✅ Found name in field '${field}': ${name}`)
      return name
    }
  }

  // If no name field found, try to find any string field that looks like a name
  const allStringFields = Object.entries(product)
    .filter(([key, value]) => typeof value === "string" && value.trim())
    .filter(([key, value]) => {
      const val = value as string
      return (
        val.length > 2 &&
        val.length < 200 &&
        !val.startsWith("http") &&
        !val.startsWith("data:") &&
        !val.match(/^[A-Za-z0-9+/]*={0,2}$/) &&
        !val.includes("base64") &&
        !key.toLowerCase().includes("image") &&
        !key.toLowerCase().includes("url") &&
        !key.toLowerCase().includes("id")
      )
    })

  console.log(`🔍 Available string fields for product ${index}:`, allStringFields.map(([key, value]) => `${key}: ${(value as string).slice(0, 50)}`))

  if (allStringFields.length > 0) {
    const [fieldName, fieldValue] = allStringFields[0]
    console.log(`✅ Using first string field '${fieldName}' as name: ${fieldValue}`)
    return (fieldValue as string).trim()
  }

  console.log(`⚠️ No name found for product ${index}, using fallback`)
  return `Product ${index + 1}`
}

function getProductCategories(product: Product): string[] {
  const categoryFields = [
    "category", "Category", "CATEGORY",
    "type", "Type", "TYPE",
    "group", "Group", "GROUP",
    "categories", "Categories", "CATEGORIES",
    "genre", "Genre", "GENRE",
    "classification", "Classification", "CLASSIFICATION",
    "Category Name", "Product Category", "Item Category",
    "product_category", "productCategory", "ProductCategory",
    "item_category", "itemCategory", "ItemCategory",
  ]

  for (const field of categoryFields) {
    if (product[field] && typeof product[field] === "string" && product[field].trim()) {
      const categoryString = product[field].trim()
      const categories = categoryString
        .split(/[|>/\\,;]/)
        .map((cat) => cat.trim())
        .filter((cat) => cat.length > 0)

      if (categories.length > 0) {
        return categories
      }
    }
  }

  return ["General"]
}

function getProductDescription(product: Product): string {
  const descFields = [
    "description", "Description", "DESCRIPTION",
    "desc", "Desc", "DESC",
    "details", "Details", "DETAILS",
    "summary", "Summary", "SUMMARY",
    "info", "Info", "INFO",
    "Product Description", "Item Description",
    "product_description", "productDescription", "ProductDescription",
    "item_description", "itemDescription", "ItemDescription",
    "about", "About", "ABOUT",
  ]

  for (const field of descFields) {
    if (product[field] && typeof product[field] === "string" && product[field].trim()) {
      return product[field].trim()
    }
  }

  return "No description available"
}

function getProductImage(product: Product): string | null {
  const imageFields = [
    "image", "Image", "IMAGE",
    "img", "Img", "IMG",
    "imageUrl", "image_url", "ImageUrl", "IMAGE_URL",
    "picture", "Picture", "PICTURE",
    "photo", "Photo", "PHOTO",
    "thumbnail", "Thumbnail", "THUMBNAIL",
    "src", "Src", "SRC",
    "url", "Url", "URL",
    "base64", "Base64", "BASE64",
    "imageData", "image_data", "ImageData", "IMAGE_DATA",
    "data", "Data", "DATA",
    "Product Image", "Item Image",
    "product_image", "productImage", "ProductImage",
    "item_image", "itemImage", "ItemImage",
  ]

  for (const field of imageFields) {
    const value = product[field]
    if (value && typeof value === "string" && value.trim()) {
      if (value.startsWith("data:image/")) {
        return value
      }
      if (value.startsWith("http")) {
        return value
      }
      if (value.match(/^[A-Za-z0-9+/]*={0,2}$/) && value.length > 100) {
        return `data:image/jpeg;base64,${value}`
      }
    }
  }

  return null
}

function getPrice(product: Product): number {
  const priceFields = [
    "price", "Price", "PRICE",
    "cost", "Cost", "COST",
    "amount", "Amount", "AMOUNT",
    "value", "Value", "VALUE",
    "Product Price", "Item Price",
    "product_price", "productPrice", "ProductPrice",
    "item_price", "itemPrice", "ItemPrice",
    "unit_price", "unitPrice", "UnitPrice",
  ]

  for (const field of priceFields) {
    if (product[field] !== undefined) {
      const value = Number.parseFloat(product[field])
      if (!isNaN(value) && value > 0) {
        return value
      }
    }
  }

  return Math.floor(Math.random() * 100) + 20
}

function getPopularity(product: Product): number {
  const popularityFields = [
    "popularity", "Popularity", "POPULARITY",
    "rating", "Rating", "RATING",
    "score", "Score", "SCORE",
    "likes", "Likes", "LIKES",
    "past_purchase_count", "pastPurchaseCount", "PastPurchaseCount",
    "purchase_count", "purchaseCount", "PurchaseCount",
    "views", "Views", "VIEWS",
    "Product Rating", "Item Rating",
    "product_rating", "productRating", "ProductRating",
    "item_rating", "itemRating", "ItemRating",
  ]

  for (const field of popularityFields) {
    if (product[field] !== undefined) {
      const value = Number.parseFloat(product[field])
      if (!isNaN(value)) {
        return Math.round(value)
      }
    }
  }

  return Math.floor(Math.random() * 1000) + 100
}

function getNetFeedback(product: Product): number {
  const feedbackFields = [
    "feedback", "Feedback", "FEEDBACK",
    "reviews", "Reviews", "REVIEWS",
    "votes", "Votes", "VOTES",
    "net_feedback", "netFeedback", "NetFeedback", "NET_FEEDBACK",
    "positive_reviews", "positiveReviews", "PositiveReviews",
    "review_score", "reviewScore", "ReviewScore", "REVIEW_SCORE",
    "thumbs_up", "thumbsUp", "ThumbsUp", "THUMBS_UP",
    "Product Reviews", "Item Reviews",
    "product_reviews", "productReviews", "ProductReviews",
    "item_reviews", "itemReviews", "ItemReviews",
  ]

  for (const field of feedbackFields) {
    if (product[field] !== undefined) {
      const value = Number.parseInt(product[field])
      if (!isNaN(value)) {
        return value
      }
    }
  }

  return Math.floor(Math.random() * 200) + 50
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const filters: FilterParams = {
    category: searchParams.get("category") || undefined,
    minPrice: searchParams.get("minPrice") ? Number.parseFloat(searchParams.get("minPrice")!) : undefined,
    maxPrice: searchParams.get("maxPrice") ? Number.parseFloat(searchParams.get("maxPrice")!) : undefined,
    search: searchParams.get("search") || undefined,
    page: searchParams.get("page") ? Number.parseInt(searchParams.get("page")!) : 1,
    limit: searchParams.get("limit") ? Number.parseInt(searchParams.get("limit")!) : 20,
    sortBy: (searchParams.get("sortBy") as FilterParams["sortBy"]) || "popularity",
    sortOrder: (searchParams.get("sortOrder") as FilterParams["sortOrder"]) || "desc",
  }

  console.log("🔍 API Request filters:", filters)

  try {
    // Fetch products from Azure Blob Storage CSV
    const rawProducts = await fetchProductsFromCSV()
    console.log(`📦 Raw products fetched: ${rawProducts.length} from ${lastSuccessfulSource}`)

    // Process and enrich products
    let processedProducts = rawProducts.map((product, index) => {
      const processedProduct = {
        ...product,
        id: product.id || product.Id || `product-${index}`,
        name: getProductName(product, index),
        categories: getProductCategories(product),
        category: getProductCategories(product)[0] || "General",
        description: getProductDescription(product),
        image: getProductImage(product),
        popularity: getPopularity(product),
        net_feedback: getNetFeedback(product),
        price: getPrice(product),
        rating: (Math.random() * 2 + 3).toFixed(1),
        stock: Math.floor(Math.random() * 50) + 5,
      }
      
      // Log the processed product name for debugging
      console.log(`📝 Processed product ${index}: name="${processedProduct.name}", category="${processedProduct.category}"`)
      
      return processedProduct
    })

    console.log(`🔧 Processed products: ${processedProducts.length}`)

    // Apply filters
    if (filters.category && filters.category !== "all") {
      processedProducts = processedProducts.filter((product) =>
        product.categories.some((cat: string) => cat.toLowerCase().includes(filters.category!.toLowerCase())),
      )
    }

    if (filters.minPrice !== undefined) {
      processedProducts = processedProducts.filter((product) => product.price >= filters.minPrice!)
    }

    if (filters.maxPrice !== undefined) {
      processedProducts = processedProducts.filter((product) => product.price <= filters.maxPrice!)
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      processedProducts = processedProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm) ||
          product.description.toLowerCase().includes(searchTerm) ||
          product.categories.some((cat: string) => cat.toLowerCase().includes(searchTerm)),
      )
    }

    // Apply sorting
    processedProducts.sort((a, b) => {
      let aValue = a[filters.sortBy!]
      let bValue = b[filters.sortBy!]

      if (filters.sortBy === "name") {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      return filters.sortOrder === "asc" ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1
    })

    // Get categories and price range
    const allCategories = new Set<string>()
    const allPrices: number[] = []

    rawProducts.forEach((product) => {
      getProductCategories(product).forEach((cat) => allCategories.add(cat))
      allPrices.push(getPrice(product))
    })

    const categories = Array.from(allCategories).sort()
    const priceRange = {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
    }

    // Apply pagination
    const totalProducts = processedProducts.length
    const totalPages = Math.ceil(totalProducts / filters.limit!)
    const startIndex = (filters.page! - 1) * filters.limit!
    const paginatedProducts = processedProducts.slice(startIndex, startIndex + filters.limit!)

    console.log(`📄 Final result: ${paginatedProducts.length} products on page ${filters.page} of ${totalPages}`)

    return NextResponse.json({
      products: paginatedProducts,
      pagination: {
        currentPage: filters.page,
        totalPages,
        totalProducts,
        hasNextPage: filters.page! < totalPages,
        hasPrevPage: filters.page! > 1,
      },
      filters: {
        categories,
        priceRange,
      },
      dataSource: lastSuccessfulSource,
      debugInfo: {
        fetchedAt: new Date().toISOString(),
        cacheAge: Date.now() - cacheTimestamp,
        lastErrorDetails,
      },
    })
  } catch (error) {
    console.error("❌ Error in API:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch products",
        details: String(error),
        dataSource: lastSuccessfulSource,
      },
      { status: 500 },
    )
  }
}
