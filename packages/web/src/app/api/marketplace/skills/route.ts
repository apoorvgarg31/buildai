import { NextResponse } from 'next/server';
import { listMarketplaceSkills, getCategories } from '@/lib/marketplace';

export async function GET() {
  try {
    const skills = listMarketplaceSkills();
    const categories = getCategories();
    return NextResponse.json({ skills, categories });
  } catch (err) {
    console.error('Marketplace list error:', err);
    return NextResponse.json({ error: 'Failed to list skills' }, { status: 500 });
  }
}
