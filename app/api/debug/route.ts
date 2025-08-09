import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      SASURL: process.env.SASURL ? "Available" : "Missing",
      SAS_URL: process.env.SAS_URL ? "Available" : "Missing",
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL ? "Running on Vercel" : "Not on Vercel",
      VERCEL_ENV: process.env.VERCEL_ENV,
    }

    // Test the SAS URL
    const sasUrl = process.env.SASURL || process.env.SAS_URL
    const fallbackUrl =
      "https://rohitproductstore.blob.core.windows.net/products/Final_dataset.csv?sp=r&st=2025-08-09T21:26:23Z&se=2025-09-30T05:41:23Z&spr=https&sv=2024-11-04&sr=b&sig=W%2BmEkqLEp8j230HSyit1bFHCfAWhyQQv6U3tgS7x72Q%3D"

    const urlToTest = sasUrl || fallbackUrl

    console.log("🔍 Debug endpoint called")
    console.log("🔍 Environment variables:", envCheck)
    console.log("🔍 URL to test:", urlToTest ? `${urlToTest.slice(0, 50)}...` : "None")

    let fetchResult = null
    let fetchError = null

    try {
      console.log("📡 Testing fetch to SAS URL...")
      const response = await fetch(urlToTest, {
        method: "GET",
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ProductGrid/1.0)",
          Accept: "text/csv, text/plain, */*",
          "Cache-Control": "no-cache",
        },
      })

      console.log(`📡 Response status: ${response.status} ${response.statusText}`)

      fetchResult = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        ok: response.ok,
      }

      if (response.ok) {
        const text = await response.text()
        fetchResult.contentLength = text.length
        fetchResult.contentPreview = text.slice(0, 200)
        fetchResult.isHTML = text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")
      } else {
        const errorText = await response.text().catch(() => "Unable to read error response")
        fetchResult.errorBody = errorText.slice(0, 500)
      }
    } catch (error) {
      console.error("❌ Fetch failed:", error)
      fetchError = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      sasUrl: {
        fromEnv: sasUrl ? "Yes" : "No",
        usingFallback: !sasUrl,
        urlLength: urlToTest.length,
        urlPreview: `${urlToTest.slice(0, 50)}...`,
      },
      fetchTest: fetchResult,
      fetchError: fetchError,
    })
  } catch (error) {
    console.error("❌ Debug endpoint error:", error)
    return NextResponse.json(
      {
        error: "Debug endpoint failed",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}
