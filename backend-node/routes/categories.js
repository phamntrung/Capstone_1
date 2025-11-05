const express = require('express');
const { authRequired } = require('../middleware/auth');
const {
  getCategoriesByUserId,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../database');

const router = express.Router();

// Helper function để format category response
function formatCategory(category) {
  return {
    id: category.id,
    userId: category.user_id,
    name: category.name,
    color: category.color || '#3b82f6',
    note: category.note || '',
    on: category.is_active !== 0 && category.is_active !== false,
    created_at: category.created_at,
    updated_at: category.updated_at
  };
}

// List categories
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const categories = await getCategoriesByUserId(userId);

    const formattedCategories = categories.map(formatCategory);
    res.json({ items: formattedCategories });
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách danh mục' });
  }
});

// Create category
router.post('/', authRequired, async (req, res) => {
  try {
    const { name, color, note, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Thiếu tên' });
    }

    const category = await createCategory({
      userId: req.user.id,
      name: name.trim(),
      color: color || '#3b82f6',
      note: note || '',
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json(formatCategory(category));
  } catch (error) {
    console.error('Create category error:', error);

    // Kiểm tra lỗi duplicate name
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ message: 'Tên danh mục đã tồn tại' });
    }

    res.status(500).json({ message: 'Lỗi tạo danh mục' });
  }
});

// Get single category
router.get('/:id', authRequired, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await getCategoryById(categoryId, req.user.id);

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    res.json(formatCategory(category));
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ message: 'Lỗi lấy danh mục' });
  }
});

// Update category
router.put('/:id', authRequired, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const existingCategory = await getCategoryById(categoryId, req.user.id);

    if (!existingCategory) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    const { name, color, note, isActive } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (note !== undefined) updates.note = note;
    if (isActive !== undefined) updates.isActive = isActive;

    const updatedCategory = await updateCategory(categoryId, req.user.id, updates);
    res.json(formatCategory(updatedCategory));
  } catch (error) {
    console.error('Update category error:', error);

    // Kiểm tra lỗi duplicate name
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ message: 'Tên danh mục đã tồn tại' });
    }

    res.status(500).json({ message: 'Lỗi cập nhật danh mục' });
  }
});

// Delete category
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const deleted = await deleteCategory(categoryId, req.user.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    res.json({ deleted: categoryId });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Lỗi xóa danh mục' });
  }
});

module.exports = router;
