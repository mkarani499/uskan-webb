// api/og-image.js
import { ImageResponse } from '@vercel/og';

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    try {
        const { searchParams } = new URL(req.url);
        const referralCode = searchParams.get('ref') || '';
        const score = searchParams.get('score') || '';

        // Font loading (optional - use system fonts if you prefer)
        const fontData = await fetch(
            'https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&display=swap'
        ).then(res => res.arrayBuffer());

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#1A2A3A',
                        padding: '40px',
                        position: 'relative',
                    }}
                >
                    {/* Background gradient */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(135deg, #1A2A3A 0%, #2C3E50 50%, #1A2A3A 100%)',
                            zIndex: 0,
                        }}
                    />

                    {/* Decorative circle */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-100px',
                            right: '-100px',
                            width: '300px',
                            height: '300px',
                            borderRadius: '50%',
                            background: 'rgba(237, 137, 54, 0.08)',
                            zIndex: 0,
                        }}
                    />

                    {/* Decorative circle 2 */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-150px',
                            left: '-150px',
                            width: '400px',
                            height: '400px',
                            borderRadius: '50%',
                            background: 'rgba(49, 130, 206, 0.06)',
                            zIndex: 0,
                        }}
                    />

                    {/* Main Content */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                            maxWidth: '700px',
                            textAlign: 'center',
                        }}
                    >
                        {/* Brain Icon */}
                        <div
                            style={{
                                fontSize: '64px',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            🧠
                        </div>

                        {/* Title */}
                        <div
                            style={{
                                fontSize: '52px',
                                fontWeight: 900,
                                color: '#FFFFFF',
                                lineHeight: 1.2,
                                marginBottom: '12px',
                                letterSpacing: '-0.02em',
                                textShadow: '0 2px 20px rgba(0,0,0,0.2)',
                            }}
                        >
                            Take the USKAN Brain Test
                        </div>

                        <div
                            style={{
                                fontSize: '32px',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #ED8936, #F6AD55)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                color: 'transparent',
                                marginBottom: '16px',
                            }}
                        >
                            & Make Money! 💰
                        </div>

                        {/* Divider */}
                        <div
                            style={{
                                width: '80px',
                                height: '3px',
                                background: 'linear-gradient(90deg, #ED8936, #F6AD55)',
                                borderRadius: '2px',
                                marginBottom: '16px',
                            }}
                        />

                        {/* Description */}
                        <div
                            style={{
                                fontSize: '24px',
                                color: '#CBD5E0',
                                fontWeight: 400,
                                lineHeight: 1.5,
                                maxWidth: '550px',
                                marginBottom: '24px',
                            }}
                        >
                            Join Me, You Might Be Good At This!
                        </div>

                        {/* CTA Button */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                backgroundColor: '#ED8936',
                                padding: '14px 40px',
                                borderRadius: '12px',
                                fontSize: '20px',
                                fontWeight: 700,
                                color: '#FFFFFF',
                                boxShadow: '0 4px 20px rgba(237, 137, 54, 0.3)',
                            }}
                        >
                            Take the Test Now →
                        </div>

                        {/* Referral Code (if present) */}
                        {referralCode && (
                            <div
                                style={{
                                    marginTop: '16px',
                                    fontSize: '14px',
                                    color: '#718096',
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                    padding: '4px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                Referral Code: {referralCode}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '24px',
                            left: 0,
                            right: 0,
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#4A5568',
                            zIndex: 1,
                        }}
                    >
                        © 2025 USKAN • 🇰🇪 Kenya
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
                fonts: [
                    {
                        name: 'Inter',
                        data: fontData,
                        style: 'normal',
                    },
                ],
            }
        );
    } catch (error) {
        console.error('OG Image Error:', error);
        return new Response('Failed to generate image', { status: 500 });
    }
}