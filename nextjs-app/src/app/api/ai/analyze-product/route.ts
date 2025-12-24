import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { description, imageUrl } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: 'وصف المنتج مطلوب' },
        { status: 400 }
      );
    }

    // Build the prompt for product analysis
    const systemPrompt = `أنت خبير تسويق ومحلل منتجات محترف. مهمتك تحليل المنتجات وتقديم توصيات استراتيجية شاملة.

يجب أن تُرجع التحليل بتنسيق JSON التالي بالضبط:
{
  "targetAudience": [
    "وصف الفئة الأولى",
    "وصف الفئة الثانية",
    "وصف الفئة الثالثة"
  ],
  "uniqueSellingPoints": [
    "نقطة البيع الأولى",
    "نقطة البيع الثانية",
    "نقطة البيع الثالثة"
  ],
  "pricingStrategy": {
    "suggestedPriceRange": "XXX - XXX ر.س",
    "profitMargin": "XX-XX%",
    "priceSensitivity": "منخفضة/متوسطة/عالية"
  },
  "marketingChannels": [
    {
      "channel": "اسم القناة",
      "priority": "عالية/متوسطة/منخفضة"
    }
  ],
  "competitiveAdvantages": [
    "ميزة تنافسية 1",
    "ميزة تنافسية 2"
  ],
  "marketingMessages": [
    "رسالة تسويقية 1",
    "رسالة تسويقية 2"
  ],
  "summary": "ملخص قصير للتحليل"
}`;

    const userPrompt = `قم بتحليل المنتج التالي وقدم توصيات استراتيجية:

وصف المنتج:
${description}

${imageUrl ? `رابط صورة المنتج: ${imageUrl}` : ''}

قدم تحليلاً شاملاً يشمل:
1. الجمهور المستهدف (3 فئات على الأقل)
2. نقاط البيع الفريدة (USPs)
3. استراتيجية التسعير المقترحة
4. القنوات التسويقية الأنسب
5. المزايا التنافسية
6. رسائل تسويقية مقترحة

أرجع النتيجة بتنسيق JSON فقط.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error('لم يتم الحصول على استجابة من الذكاء الاصطناعي');
    }

    // Parse the JSON response
    const analysis = JSON.parse(responseContent);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Error analyzing product:', error);
    
    // Return fallback data if API fails
    return NextResponse.json({
      success: true,
      analysis: {
        targetAudience: [
          'رجال الأعمال الشباب (25-40 سنة)',
          'المهتمون بالتقنية والابتكار',
          'أصحاب الدخل المتوسط-العالي',
        ],
        uniqueSellingPoints: [
          'جودة عالية بسعر تنافسي',
          'تصميم عصري وأنيق',
          'ضمان شامل لمدة سنة',
        ],
        pricingStrategy: {
          suggestedPriceRange: '299 - 399 ر.س',
          profitMargin: '35-45%',
          priceSensitivity: 'متوسطة',
        },
        marketingChannels: [
          { channel: 'Instagram', priority: 'عالية' },
          { channel: 'TikTok', priority: 'عالية' },
          { channel: 'Snapchat', priority: 'متوسطة' },
        ],
        competitiveAdvantages: [
          'خدمة عملاء متميزة',
          'توصيل سريع',
        ],
        marketingMessages: [
          'جودة لا تُضاهى بسعر منافس',
          'اكتشف الفرق مع منتجاتنا',
        ],
        summary: 'منتج واعد يستهدف شريحة واسعة من العملاء مع إمكانية نمو كبيرة في السوق.',
        isFallback: true,
      },
    });
  }
}
