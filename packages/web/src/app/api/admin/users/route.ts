import { NextRequest, NextResponse } from 'next/server';
import { listUsers, createUser } from '@/lib/admin-db';

export async function GET() {
  try {
    return NextResponse.json(listUsers());
  } catch (err) {
    console.error('List users error:', err);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, role } = body;
    if (!email || !name) {
      return NextResponse.json({ error: 'email and name are required' }, { status: 400 });
    }
    const user = createUser({ email, name, role });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
