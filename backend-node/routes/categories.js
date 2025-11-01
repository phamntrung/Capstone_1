const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// In-memory store
const categoriesById = new Map();

function nextCategoryId() {
  return categoriesById.size > 0 ? Math.max(...categoriesById.keys()) + 1 : 1;
}

// List categories
router.get('/', authRequired, (req, res) => {
  try {
    const userId = req.user.id;
    const userCategories = Array.from(categoriesById.values())
      .filter(cat => cat.userId === userId);
    
    res.json({ items: userCategories });
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách danh mục' });
  }
});

// Create category
router.post('/', authRequired, (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Thiếu tên' });
    }

    const categoryId = nextCategoryId();
    const category = {
      id: categoryId,
      userId: req.user.id,
      name: name.trim()
    };

    categoriesById.set(categoryId, category);
    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Lỗi tạo danh mục' });
  }
});

// Get single category
router.get('/:id', authRequired, (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = categoriesById.get(categoryId);

    if (!category || category.userId !== req.user.id) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ message: 'Lỗi lấy danh mục' });
  }
});

// Update category
router.put('/:id', authRequired, (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = categoriesById.get(categoryId);

    if (!category || category.userId !== req.user.id) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    const { name } = req.body;
    if (name && name.trim()) {
      category.name = name.trim();
    }

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Lỗi cập nhật danh mục' });
  }
});

// Delete category
router.delete('/:id', authRequired, (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = categoriesById.get(categoryId);

    if (!category || category.userId !== req.user.id) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    categoriesById.delete(categoryId);
    res.json({ deleted: categoryId });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Lỗi xóa danh mục' });
  }
});

module.exports = router;
