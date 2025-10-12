// Yelp reviews endpoint - fetches live reviews from Yelp Fusion API
// Get your free API key at: https://www.yelp.com/developers/v3/manage_app

export async function onRequestGet(context) {
  try {
    // Get Yelp credentials from environment
    const YELP_API_KEY = context.env.YELP_API_KEY;
    const YELP_BUSINESS_ID = context.env.YELP_BUSINESS_ID || 'k9-vision'; // Update with your actual business alias

    if (!YELP_API_KEY) {
      // Return static fallback reviews if no API key configured
      return new Response(
        JSON.stringify({
          success: true,
          reviews: [],
          static: true,
          message: 'Using static reviews - add YELP_API_KEY to enable live reviews'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch reviews from Yelp Fusion API
    const response = await fetch(
      `https://api.yelp.com/v3/businesses/${YELP_BUSINESS_ID}/reviews?limit=3&sort_by=yelp_sort`,
      {
        headers: {
          'Authorization': `Bearer ${YELP_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Yelp API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        reviews: data.reviews,
        total: data.total,
        static: false
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      }
    );

  } catch (error) {
    console.error('Yelp API error:', error);

    // Return empty array on error - frontend will use static reviews
    return new Response(
      JSON.stringify({
        success: false,
        reviews: [],
        static: true,
        error: error.message
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
