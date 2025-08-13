import { type NextRequest, NextResponse } from "next/server"

// Import the shared latestRecommendations variable from session route
import { latestRecommendations } from "../session/route"

interface RecommendationItem {
  rank: number
  similarity_score: number
  id: string
  name: string
  category: string
  price: number
  image: string // base64 encoded image
  description: string
}

interface RecommendationsRequest {
  recommendations: RecommendationItem[]
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎯 Recommendations API called - processing incoming recommendations")

    // Parse the request body
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError)
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details: "Request body must be valid JSON",
          timestamp: new Date().toISOString(),
        },
        { status: 400, headers: corsHeaders() },
      )
    }

    let recommendations: RecommendationItem[]

    if (typeof body.recommendations === "string") {
      console.log("📝 Recommendations received as JSON string, parsing...")
      try {
        const parsed = JSON.parse(body.recommendations)
        recommendations = parsed.recommendations || parsed
      } catch (stringParseError) {
        console.error("❌ Failed to parse recommendations JSON string:", stringParseError)
        return NextResponse.json(
          {
            error: "Invalid recommendations JSON string",
            details: "Recommendations field contains invalid JSON string",
            timestamp: new Date().toISOString(),
          },
          { status: 400, headers: corsHeaders() },
        )
      }
    } else if (Array.isArray(body.recommendations)) {
      recommendations = body.recommendations
    } else {
      console.error("❌ Invalid recommendations format:", body)
      return NextResponse.json(
        {
          error: "Invalid recommendations format",
          details: "Request body must contain a 'recommendations' array or JSON string",
          timestamp: new Date().toISOString(),
        },
        { status: 400, headers: corsHeaders() },
      )
    }

    // Validate that recommendations array exists and is valid
    if (!Array.isArray(recommendations)) {
      console.error("❌ Recommendations is not an array:", recommendations)
      return NextResponse.json(
        {
          error: "Invalid recommendations format",
          details: "Recommendations must be an array",
          timestamp: new Date().toISOString(),
        },
        { status: 400, headers: corsHeaders() },
      )
    }

    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i]
      console.log(`🔍 Validating recommendation ${i + 1}:`, {
        rank: { value: rec.rank, type: typeof rec.rank, valid: typeof rec.rank === "number" },
        similarity_score: {
          value: rec.similarity_score,
          type: typeof rec.similarity_score,
          valid: typeof rec.similarity_score === "number",
        },
        id: { value: rec.id, type: typeof rec.id, valid: !!rec.id },
        name: { value: rec.name, type: typeof rec.name, valid: !!rec.name },
        category: { value: rec.category, type: typeof rec.category, valid: !!rec.category },
        price: { value: rec.price, type: typeof rec.price, valid: typeof rec.price === "number" },
        image: { hasImage: !!rec.image, type: typeof rec.image, length: rec.image?.length || 0 },
        description: {
          hasDescription: !!rec.description,
          type: typeof rec.description,
          length: rec.description?.length || 0,
        },
      })

      if (
        typeof rec.rank !== "number" ||
        typeof rec.similarity_score !== "number" ||
        !rec.id ||
        !rec.name ||
        !rec.category ||
        typeof rec.price !== "number" ||
        !rec.image ||
        !rec.description
      ) {
        console.error("❌ Invalid recommendation item format:", rec)
        console.error("❌ Validation details:", {
          rankValid: typeof rec.rank === "number",
          similarityValid: typeof rec.similarity_score === "number",
          idValid: !!rec.id,
          nameValid: !!rec.name,
          categoryValid: !!rec.category,
          priceValid: typeof rec.price === "number",
          imageValid: !!rec.image,
          descriptionValid: !!rec.description,
        })
        return NextResponse.json(
          {
            error: "Invalid recommendation item format",
            details:
              "Each recommendation must have: rank (number), similarity_score (number), id (string), name (string), category (string), price (number), image (base64 string), description (string)",
            failedItem: i + 1,
            validation: {
              rankValid: typeof rec.rank === "number",
              similarityValid: typeof rec.similarity_score === "number",
              idValid: !!rec.id,
              nameValid: !!rec.name,
              categoryValid: !!rec.category,
              priceValid: typeof rec.price === "number",
              imageValid: !!rec.image,
              descriptionValid: !!rec.description,
            },
            timestamp: new Date().toISOString(),
          },
          { status: 400, headers: corsHeaders() },
        )
      }
    }

    console.log(`📥 Received ${recommendations.length} recommendations:`)
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.name} (${rec.category})`)
      console.log(`      Rank: ${rec.rank}, Similarity: ${rec.similarity_score}`)
      console.log(`      Price: $${rec.price}`)
      console.log(`      ID: ${rec.id}`)
    })

    // Store recommendations in memory (replace the entire array)
    latestRecommendations.length = 0 // Clear existing recommendations
    latestRecommendations.push(...recommendations) // Add new recommendations

    const timestampedRecommendations = latestRecommendations.map((rec) => ({
      ...rec,
      receivedAt: new Date().toISOString(),
    }))

    // Update the stored recommendations with timestamps
    latestRecommendations.length = 0
    latestRecommendations.push(...timestampedRecommendations)

    console.log(`✅ Successfully stored ${latestRecommendations.length} recommendations in memory`)

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Recommendations received and stored successfully",
        count: recommendations.length,
        timestamp: new Date().toISOString(),
        storedRecommendations: latestRecommendations.length,
      },
      { status: 200, headers: corsHeaders() },
    )
  } catch (error) {
    console.error("❌ Error in recommendations API:", error)

    return NextResponse.json(
      {
        error: "Failed to process recommendations",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}

// Also support GET method to retrieve current recommendations
export async function GET(request: NextRequest) {
  try {
    console.log("📊 Recommendations GET API called - retrieving stored recommendations")

    return NextResponse.json(
      {
        recommendations: latestRecommendations,
        count: latestRecommendations.length,
        timestamp: new Date().toISOString(),
        message:
          latestRecommendations.length > 0 ? "Retrieved stored recommendations" : "No recommendations currently stored",
      },
      { status: 200, headers: corsHeaders() },
    )
  } catch (error) {
    console.error("❌ Error retrieving recommendations:", error)

    return NextResponse.json(
      {
        error: "Failed to retrieve recommendations",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}
