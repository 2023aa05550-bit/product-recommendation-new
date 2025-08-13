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

// Streaming CSV parser for large files
async function parseCSVStream(response: Response): Promise<Product[]> {
  console.log(`🔍 Starting streaming CSV parse`)

  if (!response.body) {
    throw new Error("Response body is null")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ""
  let headers: string[] = []
  let headersParsed = false
  const products: Product[] = []
  let lineCount = 0
  const MAX_PRODUCTS = 1000 // Updated memory limit to 1000 products
  let totalLinesProcessed = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      let newlineIndex
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)

        if (!line) continue // Skip empty lines

        lineCount++
        totalLinesProcessed++

        if (!headersParsed) {
          // Parse headers
          headers = parseCSVLine(line)
          headersParsed = true
          console.log(`📋 CSV Headers (${headers.length}):`, headers.slice(0, 10))
          continue
        }

        // Parse data row
        try {
          const values = parseCSVLine(line)
          const product: Product = {}

          headers.forEach((header, index) => {
            product[header] = values[index] || ""
          })

          product.originalIndex = products.length
          products.push(product)

          // Log first few products for debugging
          if (products.length <= 3) {
            console.log(`📦 Sample product ${products.length}:`, {
              name: getProductName(product, products.length - 1),
              category: getProductCategories(product)[0],
              price: getPrice(product),
            })
          }

          // Stop if we have enough products
          if (products.length >= MAX_PRODUCTS) {
            console.log(`🛑 Reached maximum products limit: ${MAX_PRODUCTS}`)
            console.log(`📊 Total lines processed: ${totalLinesProcessed}`)
            console.log(`⚠️ NOTE: Additional products in the CSV file will NOT be loaded due to memory constraints`)
            break
          }
        } catch (rowError) {
          console.warn(`⚠️ Failed to parse row ${lineCount}: ${rowError.message}`)
          continue
        }
      }

      // Break if we have enough products
      if (products.length >= MAX_PRODUCTS) break
    }

    // Process any remaining buffer content if we haven't hit the limit
    if (products.length < MAX_PRODUCTS && buffer.trim()) {
      totalLinesProcessed++
      try {
        const values = parseCSVLine(buffer.trim())
        const product: Product = {}

        headers.forEach((header, index) => {
          product[header] = values[index] || ""
        })

        product.originalIndex = products.length
        products.push(product)
      } catch (rowError) {
        console.warn(`⚠️ Failed to parse final buffer: ${rowError.message}`)
      }
    }
  } finally {
    reader.releaseLock()
  }

  console.log(`📦 Streaming parse complete: ${products.length} products loaded from ${totalLinesProcessed} total lines`)

  if (products.length >= MAX_PRODUCTS) {
    console.log(
      `⚠️ IMPORTANT: Only the first ${MAX_PRODUCTS} products were loaded. The CSV file contains more data that was not processed.`,
    )
    console.log(`💡 To load more products, increase MAX_PRODUCTS (but be aware of memory constraints)`)
  } else {
    console.log(`✅ All available products were loaded (${products.length} total)`)
  }

  if (products.length === 0) {
    throw new Error(`No valid products found. Processed ${totalLinesProcessed} lines`)
  }

  return products
}

// Helper function to parse a single CSV line
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let currentValue = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      values.push(currentValue.trim().replace(/^"|"$/g, ""))
      currentValue = ""
    } else {
      currentValue += char
    }
  }

  // Add the last value
  values.push(currentValue.trim().replace(/^"|"$/g, ""))
  return values
}

// Helper functions to extract data from products
function getProductName(product: Product, index: number): string {
  const nameFields = [
    "name",
    "Name",
    "NAME",
    "title",
    "Title",
    "TITLE",
    "product_name",
    "productName",
    "ProductName",
    "PRODUCT_NAME",
    "item_name",
    "itemName",
    "ItemName",
    "ITEM_NAME",
    "product_title",
    "productTitle",
    "ProductTitle",
    "PRODUCT_TITLE",
    "Product Name",
    "Product Title",
    "Item Name",
    "Item Title",
    "description",
    "Description",
    "DESCRIPTION",
  ]

  for (const field of nameFields) {
    if (product[field] && typeof product[field] === "string" && product[field].trim()) {
      return product[field].trim()
    }
  }

  // Find any string field that looks like a name
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

  if (allStringFields.length > 0) {
    return (allStringFields[0][1] as string).trim()
  }

  return `Product ${index + 1}`
}

function getProductCategories(product: Product): string[] {
  const categoryFields = [
    "category",
    "Category",
    "CATEGORY",
    "type",
    "Type",
    "TYPE",
    "group",
    "Group",
    "GROUP",
    "categories",
    "Categories",
    "CATEGORIES",
    "genre",
    "Genre",
    "GENRE",
    "classification",
    "Classification",
    "CLASSIFICATION",
    "Category Name",
    "Product Category",
    "Item Category",
    "product_category",
    "productCategory",
    "ProductCategory",
    "item_category",
    "itemCategory",
    "ItemCategory",
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
    "description",
    "Description",
    "DESCRIPTION",
    "desc",
    "Desc",
    "DESC",
    "details",
    "Details",
    "DETAILS",
    "summary",
    "Summary",
    "SUMMARY",
    "info",
    "Info",
    "INFO",
    "Product Description",
    "Item Description",
    "product_description",
    "productDescription",
    "ProductDescription",
    "item_description",
    "itemDescription",
    "ItemDescription",
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
    "image",
    "Image",
    "IMAGE",
    "img",
    "Img",
    "IMG",
    "imageUrl",
    "image_url",
    "ImageUrl",
    "IMAGE_URL",
    "picture",
    "Picture",
    "PICTURE",
    "photo",
    "Photo",
    "PHOTO",
    "thumbnail",
    "Thumbnail",
    "THUMBNAIL",
    "src",
    "Src",
    "SRC",
    "url",
    "Url",
    "URL",
    "base64",
    "Base64",
    "BASE64",
    "imageData",
    "image_data",
    "ImageData",
    "IMAGE_DATA",
    "data",
    "Data",
    "DATA",
    "Product Image",
    "Item Image",
    "product_image",
    "productImage",
    "ProductImage",
    "item_image",
    "itemImage",
    "ItemImage",
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
    "price",
    "Price",
    "PRICE",
    "cost",
    "Cost",
    "COST",
    "amount",
    "Amount",
    "AMOUNT",
    "value",
    "Value",
    "VALUE",
    "Product Price",
    "Item Price",
    "product_price",
    "productPrice",
    "ProductPrice",
    "item_price",
    "itemPrice",
    "ItemPrice",
    "unit_price",
    "unitPrice",
    "UnitPrice",
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
    "popularity",
    "Popularity",
    "POPULARITY",
    "rating",
    "Rating",
    "RATING",
    "score",
    "Score",
    "SCORE",
    "likes",
    "Likes",
    "LIKES",
    "past_purchase_count",
    "pastPurchaseCount",
    "PastPurchaseCount",
    "purchase_count",
    "purchaseCount",
    "PurchaseCount",
    "views",
    "Views",
    "VIEWS",
    "Product Rating",
    "Item Rating",
    "product_rating",
    "productRating",
    "ProductRating",
    "item_rating",
    "itemRating",
    "ItemRating",
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
    "feedback",
    "Feedback",
    "FEEDBACK",
    "reviews",
    "Reviews",
    "REVIEWS",
    "votes",
    "Votes",
    "VOTES",
    "net_feedback",
    "netFeedback",
    "NetFeedback",
    "NET_FEEDBACK",
    "positive_reviews",
    "positiveReviews",
    "PositiveReviews",
    "review_score",
    "reviewScore",
    "ReviewScore",
    "REVIEW_SCORE",
    "thumbs_up",
    "thumbsUp",
    "ThumbsUp",
    "THUMBS_UP",
    "Product Reviews",
    "Item Reviews",
    "product_reviews",
    "productReviews",
    "ProductReviews",
    "item_reviews",
    "itemReviews",
    "ItemReviews",
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

function getAboutProduct(product: Product): string {
  const aboutFields = [
    "about",
    "About",
    "ABOUT",
    "about_product",
    "aboutProduct",
    "AboutProduct",
    "ABOUT_PRODUCT",
    "product_about",
    "productAbout",
    "ProductAbout",
    "PRODUCT_ABOUT",
    "details",
    "Details",
    "DETAILS",
    "specifications",
    "Specifications",
    "SPECIFICATIONS",
    "features",
    "Features",
    "FEATURES",
    "overview",
    "Overview",
    "OVERVIEW",
    "summary",
    "Summary",
    "SUMMARY",
    "info",
    "Info",
    "INFO",
    "product_info",
    "productInfo",
    "ProductInfo",
    "PRODUCT_INFO",
    "long_description",
    "longDescription",
    "LongDescription",
    "LONG_DESCRIPTION",
    "extended_description",
    "extendedDescription",
    "ExtendedDescription",
    "EXTENDED_DESCRIPTION",
  ]

  for (const field of aboutFields) {
    if (product[field] && typeof product[field] === "string" && product[field].trim()) {
      return product[field].trim()
    }
  }

  // Fallback to description if no specific "about" field found
  return getProductDescription(product)
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

  const sasUrl = process.env.SASURL || process.env.SAS_URL
  const fallbackUrl =
    "https://rohitproductstore.blob.core.windows.net/products/Final_dataset.csv?sp=r&st=2025-08-09T21:26:23Z&se=2025-09-30T05:41:23Z&spr=https&sv=2024-11-04&sr=b&sig=W%2BmEkqLEp8j230HSyit1bFHCfAWhyQQv6U3tgS7x72Q%3D"
  const azureSasUrl = sasUrl || fallbackUrl

  console.log(`🎯 PRIORITY FETCH: Attempting to load CSV from Azure Blob Storage`)
  console.log(`🔗 Environment variable SASURL: ${process.env.SASURL ? "✅ Found" : "❌ Not found"}`)
  console.log(`🔗 Environment variable SAS_URL: ${process.env.SAS_URL ? "✅ Found" : "❌ Not found"}`)
  console.log(`🔗 Using ${sasUrl ? "environment variable" : "fallback"} URL`)
  console.log(`📊 Memory limit set to: 1000 products`)

  try {
    console.log(`📡 Starting streaming fetch request to Azure Blob Storage...`)

    const response = await fetch(azureSasUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProductGrid/1.0)",
        Accept: "text/csv, text/plain, */*",
        "Cache-Control": "no-cache",
      },
    })

    console.log(`📡 Azure Blob Storage Response: ${response.status} ${response.statusText}`)
    console.log(`📄 Content-Type: ${response.headers.get("content-type") || "unknown"}`)
    console.log(`📄 Content-Length: ${response.headers.get("content-length") || "unknown"}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error("Response body is null - streaming not supported")
    }

    // Use streaming parser for large files
    let productsArray: Product[]
    try {
      productsArray = await parseCSVStream(response)
      console.log(`✅ CSV streaming parse successful`)
      console.log(`📊 Products array length: ${productsArray.length}`)
    } catch (parseError) {
      console.error(`❌ CSV streaming parse error:`, parseError)
      throw new Error(`Invalid CSV format: ${parseError.message}`)
    }

    if (productsArray.length === 0) {
      throw new Error("CSV parsed successfully but contains no product data")
    }

    // Process products with source tracking
    const processedProducts = productsArray.map((product, index) => ({
      ...product,
      id: product.id || product.Id || product.ID || `csv-product-${index}`,
      dataSource: "Azure Blob Storage CSV (Streaming)",
      fetchedAt: new Date().toISOString(),
    }))

    console.log(`🎉 SUCCESS: Loaded ${processedProducts.length} products from Azure Blob Storage CSV`)

    // Cache the results
    cachedProducts = processedProducts
    cacheTimestamp = Date.now()
    lastSuccessfulSource = "Azure Blob Storage CSV (Streaming)"
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
        console.log(`🔄 Trying: ${source.name}`)

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
    lastErrorDetails = `All sources failed. Primary error: ${error.message}. Using sample data.`

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
        about_product: getAboutProduct(product),
        image: getProductImage(product),
        popularity: getPopularity(product),
        net_feedback: getNetFeedback(product),
        price: getPrice(product),
        rating: (Math.random() * 2 + 3).toFixed(1),
        stock: Math.floor(Math.random() * 50) + 5,
      }

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
        environmentVariables: {
          SASURL: process.env.SASURL ? "Available" : "Missing",
          SAS_URL: process.env.SAS_URL ? "Available" : "Missing",
        },
      },
    })
  } catch (error) {
    console.error("❌ Error in API:", error)

    return NextResponse.json(
      {
        error: "Failed to fetch products",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        dataSource: lastSuccessfulSource,
        environmentCheck: {
          SASURL: process.env.SASURL ? "Available" : "Missing",
          SAS_URL: process.env.SAS_URL ? "Available" : "Missing",
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL ? "Running on Vercel" : "Not on Vercel",
        },
      },
      { status: 500 },
    )
  }
}
