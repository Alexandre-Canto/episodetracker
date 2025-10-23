import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const PATCH = requireAuth(async (request: NextRequest, user: AuthenticatedUser, context?: { params: { showId: string } }) => {
  try {
    const body = await request.json()
    const { status, rating } = body
    const userShowId = context?.params?.showId

    if (!userShowId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }

    // Validate that at least one field is being updated
    if (!status && rating === undefined) {
      return NextResponse.json(
        { error: 'At least one field (status or rating) must be provided' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status && !['ongoing', 'watchlater', 'ended', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || rating < 1 || rating > 10) {
        return NextResponse.json(
          { error: 'Rating must be a number between 1 and 10' },
          { status: 400 }
        )
      }
    }

    const userShow = await prisma.userShow.findFirst({
      where: {
        id: userShowId,
        userId: user.id
      }
    })

    if (!userShow) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }

    // Build update data object
    const updateData: any = {}
    if (status) updateData.status = status
    if (rating !== undefined) updateData.rating = rating

    const updatedUserShow = await prisma.userShow.update({
      where: { id: userShowId },
      data: updateData,
      include: {
        show: true
      }
    })

    return NextResponse.json({ userShow: updatedUserShow })
  } catch (error) {
    console.error('Update show error:', error)
    return NextResponse.json(
      { error: 'Failed to update show' },
      { status: 500 }
    )
  }
})

export const DELETE = requireAuth(async (request: NextRequest, user: AuthenticatedUser, context?: { params: { showId: string } }) => {
  try {
    const userShowId = context?.params?.showId

    if (!userShowId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }

    const userShow = await prisma.userShow.findFirst({
      where: {
        id: userShowId,
        userId: user.id
      }
    })

    if (!userShow) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }

    await prisma.userShow.delete({
      where: { id: userShowId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove show error:', error)
    return NextResponse.json(
      { error: 'Failed to remove show' },
      { status: 500 }
    )
  }
})
